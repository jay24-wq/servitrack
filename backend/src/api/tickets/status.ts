import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { assignTechnicianManually } from '@services/ticketAssignmentService';
import { notifyTicketStatusChanged } from '@services/notifications/events';

export const statusRouter = Router();

statusRouter.use(authMiddleware);
statusRouter.use(tenantResolver);

// PUT /api/tickets/:id/assign - Manual technician override
statusRouter.put('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
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

    const existingTicket = await reqDb(req)('service_tickets').where({ id, tenant_id }).first();
    if (!existingTicket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }
    const customer = await reqDb(req)('customers').where({ id: existingTicket.customer_id, tenant_id }).select('phone_wa').first();

    const result = await withTenantContext(tenant_id, (trx) =>
      assignTechnicianManually(trx, {
        tenantId: tenant_id,
        ticketId: id,
        technicianId: technician_id.trim(),
        assignedBy: req.user!.user_id,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        note,
        nextStatus: to_status,
      })
    );

    if (to_status && existingTicket.current_status !== to_status) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id,
        customerId: existingTicket.customer_id,
        phone: customer?.phone_wa ?? '',
        ticketId: id,
        trackingCode: result.ticket.tracking_code,
        status: to_status,
      });
    }

    res.json({
      message: 'Penugasan teknisi berhasil diperbarui',
      data: {
        ticket: result.ticket,
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
    res.status(error.status || 500).json({ error: error.message || 'Gagal memperbarui penugasan' });
  }
});
