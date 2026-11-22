import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { assignTechnicianManually } from '@services/ticketAssignmentService';
import { notifyTicketStatusChanged } from '@services/notifications/events';
import { logAudit } from '@services/auditLog';
import { canTransitionTicket } from '@common/utils/TicketStatuses';

export const statusRouter = Router();

statusRouter.use(authMiddleware);
statusRouter.use(tenantResolver);

// PUT /api/tickets/:id/assign - Manual technician override
statusRouter.put('/:id/assign', async (req: AuthRequest, res: Response) => {
  const tenant_id = req.user?.tenant_id;
  let transitionAttempt: { ticketId: string; from: string; to: string } | null = null;
  try {
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { id } = req.params;
    const { technician_id, to_status, note } = req.body;

    if (typeof technician_id !== 'string' || !technician_id.trim()) {
      res.status(400).json({ error: 'technician_id wajib diisi' });
      return;
    }

    const valid = ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil'];
    if (to_status !== undefined && !valid.includes(to_status)) {
      res.status(400).json({ error: 'Status tidak valid' });
      return;
    }

    const existingTicket = await reqDb(req)('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).first();
    if (!existingTicket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }
    const customer = await reqDb(req)('customers').where({ id: existingTicket.customer_id, tenant_id }).select('phone_wa').first();

    const result = await withTenantContext(tenant_id, async (trx) => {
      const before = await trx('service_tickets')
        .where({ id, tenant_id, branch_id: req.user?.branch_id })
        .forUpdate()
        .select('*')
        .first();
      if (before && to_status) transitionAttempt = { ticketId: id, from: before.current_status, to: to_status };
      if (to_status && before && before.current_status !== to_status && !canTransitionTicket(before.current_status, to_status)) {
        throw Object.assign(new Error(`Transisi status tidak diizinkan: ${before.current_status} → ${to_status}`), { status: 409 });
      }
      if (to_status === 'pengerjaan') {
        const quote = await trx('quotations').where({ ticket_id: id, tenant_id }).orderBy('created_at', 'desc').first();
        if (quote && ['draft', 'sent'].includes(quote.status)) throw Object.assign(new Error('Pengerjaan diblokir karena quotation belum disetujui'), { status: 409 });
        if (before?.current_status === 'pengecekan' && (!before.work_type || before.diagnosis_status !== 'matches_complaint')) {
          throw Object.assign(new Error('Simpan diagnosa sesuai keluhan melalui workflow pengecekan'), { status: 409 });
        }
        if (before?.work_type === 'with_parts' && before.diagnosis_status === 'additional_damage' && before.workflow_resolution !== 'continue_original' && quote?.status !== 'approved') {
          throw Object.assign(new Error('Pengerjaan hanya dapat dimulai setelah quotation approved'), { status: 409 });
        }
        if (before?.work_type === 'with_parts' && quote?.status === 'approved' && before.workflow_resolution !== 'continue_original') {
          const openRequests = await trx('part_requests').where({ tenant_id, quotation_id: quote.id }).whereIn('status', ['OPEN', 'ORDERED']).whereNull('linked_part_id');
          if (openRequests.length) throw Object.assign(new Error(`Part belum diterima: ${openRequests.map((item) => item.requested_name).join(', ')}`), { status: 409 });
          const items = await trx('quotation_items').where({ tenant_id, quotation_id: quote.id, item_type: 'part' });
          if (items.some((item) => item.part_is_registered === false && !item.part_id)) throw Object.assign(new Error('Part custom harus ditautkan ke inventory sebelum pengerjaan'), { status: 409 });
          const required = new Map<string, number>();
          for (const item of items) if (item.part_id) required.set(item.part_id, (required.get(item.part_id) ?? 0) + Number(item.qty));
          for (const [partId, qty] of required) {
            const part = await trx('parts').where({ id: partId, tenant_id, branch_id: before.branch_id }).forUpdate().first();
            if (!part || Number(part.stock_qty) < qty) throw Object.assign(new Error(`Stok ${part?.name ?? 'sparepart'} belum cukup`), { status: 409 });
          }
        } else if (before?.work_type === 'with_parts' && before.requested_part_id) {
          const part = await trx('parts').where({ id: before.requested_part_id, tenant_id, branch_id: before.branch_id }).forUpdate().first();
          if (!part || Number(part.stock_qty) < Number(before.requested_part_qty)) throw Object.assign(new Error('Stok sparepart belum cukup untuk pengerjaan'), { status: 409 });
        }
      }
      if (to_status === 'menunggu_part') throw Object.assign(new Error('Gunakan workflow status tiket untuk mencatat kekurangan sparepart'), { status: 409 });
      if (to_status === 'quality_check' && before?.work_type === 'with_parts') {
        const [usage] = await trx('ticket_part_usages as usage')
          .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
          .where({ 'usage.tenant_id': tenant_id, 'usage.ticket_id': id })
          .select(trx.raw('COALESCE(SUM(usage.qty - COALESCE(reversal.qty, 0)), 0) AS qty'));
        if (Number(usage?.qty ?? 0) <= 0) throw Object.assign(new Error('Catat pemakaian sparepart sebelum Quality Control'), { status: 409 });
      }
      const assignment = await assignTechnicianManually(trx, {
        tenantId: tenant_id,
        branchId: req.user!.branch_id!,
        ticketId: id,
        technicianId: technician_id.trim(),
        assignedBy: req.user!.user_id,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        note,
        nextStatus: to_status,
      });
      if (before && before.current_status !== assignment.ticket.current_status) {
        await logAudit(trx, req, {
          action: 'ticket.status_changed',
          entityType: 'service_ticket',
          entityId: id,
          oldValues: { ticket_code: before.ticket_code, current_status: before.current_status },
          newValues: { ticket_code: assignment.ticket.ticket_code, current_status: assignment.ticket.current_status },
        });
      }
      return {
        ...assignment,
        previousStatus: before?.current_status ?? existingTicket.current_status,
        statusChanged: before?.current_status !== assignment.ticket.current_status,
      };
    });

    if (to_status && result.statusChanged) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id,
        customerId: existingTicket.customer_id,
        phone: customer?.phone_wa ?? '',
        ticketId: id,
        trackingCode: result.ticket.tracking_code,
        previousStatus: result.previousStatus ?? existingTicket.current_status,
        status: to_status,
      });
    }

    const ticketResponse = { ...result.ticket };
    delete ticketResponse.device_pin_enc;
    delete ticketResponse.device_pin_refused;
    delete ticketResponse.owner_id_number_enc;
    delete ticketResponse.technician_note;

    res.json({
      message: 'Penugasan teknisi berhasil diperbarui',
      data: {
        ticket: ticketResponse,
        from_technician: result.fromTechnician,
        to_technician: {
          id: result.toTechnician.id,
          name: result.toTechnician.name,
          active_count: result.toTechnician.active_count,
        },
        note: result.note,
      },
    });
  } catch (error: any) {
    if (transitionAttempt && tenant_id && error.status === 409) {
      try {
        await withTenantContext(tenant_id, (trx) => logAudit(trx, req, {
          action: 'ticket.status_transition_rejected',
          entityType: 'service_ticket', entityId: transitionAttempt!.ticketId,
          oldValues: { current_status: transitionAttempt!.from },
          newValues: { attempted_status: transitionAttempt!.to, error: error.message },
          note: error.message,
        }));
      } catch { /* Preserve the rejected transition response. */ }
    }
    res.status(error.status || 500).json({ error: error.message || 'Gagal memperbarui penugasan' });
  }
});
