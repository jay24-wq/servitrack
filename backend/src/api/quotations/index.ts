import { Router, Response } from 'express';
import { validate as isUuid } from 'uuid';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
import { notifyQuotationCreated, notifyTicketStatusChanged } from '@services/notifications/events';
import { logAudit } from '@services/auditLog';
import { decideQuotation, resolveRejectedQuotation } from '@services/quotationWorkflow';
import { createQuotationToken, hashQuotationToken } from '@utils/quotationToken';
import { priceQuotationLine } from '@services/quotationPricing';
import { MAX_INSPECTION_LENGTH, mergeInspectionResult } from '@services/ticketInspection';
import { createPendingPartRequests, transitionQuotationPartRequests } from '@services/partRequests';

export const quotationRouter = Router();

function scheduleQuotationDelivery(
  input: Parameters<typeof notifyQuotationCreated>[0],
  details: { branchId: string; requestedBy: string; items: any[] }
) {
  setImmediate(() => {
    void notifyQuotationCreated(input).then((notification) => withTenantContext(input.tenantId, async (trx) => {
      let quotation: any;
      if (notification.status === 'sent') {
        [quotation] = await trx('quotations')
          .where({ id: input.quotationId, tenant_id: input.tenantId, status: 'draft' })
          .update({ status: 'sent' })
          .returning('*');
        if (!quotation) return false;
        await createPendingPartRequests(trx, {
          tenantId: input.tenantId,
          branchId: details.branchId,
          ticketId: input.ticketId!,
          quotationId: input.quotationId!,
          requestedBy: details.requestedBy,
          items: details.items,
        });
      } else {
        quotation = await trx('quotations').where({ id: input.quotationId, tenant_id: input.tenantId, status: 'draft' }).first();
        if (!quotation) return false;
      }
      await trx('audit_logs').insert({
        tenant_id: input.tenantId,
        action: notification.status === 'sent' ? 'quotation.sent' : 'quotation.send_failed',
        entity_type: 'quotation',
        entity_id: input.quotationId,
        ticket_id: input.ticketId,
        quotation_id: input.quotationId,
        notification_id: 'id' in notification ? notification.id : null,
        actor_type: 'system',
        old_values: { status: 'draft' },
        new_values: {
          status: notification.status === 'sent' ? 'sent' : 'draft',
          notification_status: notification.status,
          notification_id: 'id' in notification ? notification.id : null,
          error_code: 'errorCode' in notification ? notification.errorCode ?? null : null,
          provider_message_id: 'providerMessageId' in notification ? notification.providerMessageId ?? null : null,
        },
      });
      return true;
    })).catch((error) => console.error('[Quotation] pengiriman WhatsApp gagal diproses', error));
  });
}

quotationRouter.use(authMiddleware);
quotationRouter.use(tenantResolver);
quotationRouter.use(branchResolver);

// Create and send a quotation from the technician's persisted inspection.
quotationRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const {
      ticket_id,
      work_type,
      diagnosis_status,
      technician_diagnosis,
      additional_damage,
      technician_note: legacyNote,
      part_id,
      part_qty,
      labor_estimate,
      items: requestedItems,
    } = req.body ?? {};
    const diagnosis = mergeInspectionResult(technician_diagnosis, legacyNote);
    const damage = String(additional_damage ?? '').trim();
    const labor = Number(labor_estimate ?? 0);

    if (!tenantId) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const usesLineItems = Array.isArray(requestedItems);
    if (!isUuid(ticket_id) || !['without_parts', 'with_parts'].includes(work_type) ||
      !['matches_complaint', 'additional_damage'].includes(diagnosis_status) || !diagnosis || diagnosis.length > MAX_INSPECTION_LENGTH || damage.length > MAX_INSPECTION_LENGTH ||
      !Number.isFinite(labor) || labor < 0 ||
      (!usesLineItems && work_type === 'with_parts' && (!isUuid(part_id) || !Number.isSafeInteger(part_qty) || part_qty <= 0))) {
      res.status(400).json({ error: 'Lengkapi Hasil Pemeriksaan Teknisi, jenis pengerjaan, dan estimasi quotation yang valid (maksimal 4000 karakter)' });
      return;
    }
    if (!usesLineItems && diagnosis_status === 'additional_damage' && work_type === 'without_parts' && labor <= 0) {
      res.status(400).json({ error: 'Estimasi biaya jasa wajib diisi untuk quotation tanpa sparepart' });
      return;
    }

    const result = await withTenantContext(tenantId, async (trx) => {
      const ticket = await trx('service_tickets')
        .where({ id: ticket_id, tenant_id: tenantId, branch_id: req.user?.branch_id })
        .forUpdate()
        .first();
      if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });
      const priorQuotation = await trx('quotations').where({ ticket_id, tenant_id: tenantId }).orderBy('created_at', 'desc').first();
      const isRevision = ticket.current_status === 'menunggu_persetujuan' && ['expired', 'cancelled', 'superseded'].includes(priorQuotation?.status);
      if (ticket.current_status !== 'pengecekan' && !isRevision) {
        throw Object.assign(new Error('Quotation hanya dapat dibuat dari tahap Pengecekan'), { status: 409 });
      }
      if (await trx('quotations').where({ ticket_id, tenant_id: tenantId }).whereIn('status', ['draft', 'sent']).first()) {
        throw Object.assign(new Error('Masih ada quotation yang menunggu persetujuan'), { status: 409 });
      }

      const lineInputs = usesLineItems
        ? requestedItems
        : [{ damage_description: damage || diagnosis, part_id: work_type === 'with_parts' ? part_id : null, qty: part_qty ?? 1, labor_cost: labor }];
      if (lineInputs.length < 1 || lineInputs.length > 50) throw Object.assign(new Error('Quotation harus memiliki 1–50 item kerusakan'), { status: 400 });
      const items: Array<Record<string, any>> = [];
      let hasPart = false;
      let hasUnregisteredPart = false;
      for (const line of lineInputs) {
        const damageDescription = String(line?.damage_description ?? '').trim();
        const quantity = Number(line?.qty);
        const laborCost = Number(line?.labor_cost ?? 0);
        const requestedPartId = line?.part_id ? String(line.part_id) : null;
        const unregistered = line?.is_unregistered_part === true;
        if (!damageDescription || damageDescription.length > MAX_INSPECTION_LENGTH || !Number.isSafeInteger(quantity) || quantity <= 0 ||
          !Number.isFinite(laborCost) || laborCost < 0 || (requestedPartId && !isUuid(requestedPartId))) {
          throw Object.assign(new Error('Kerusakan, quantity, part, atau biaya jasa pada item quotation tidak valid'), { status: 400 });
        }
        if (work_type === 'without_parts' && (requestedPartId || unregistered)) {
          throw Object.assign(new Error('Jenis pengerjaan tanpa sparepart tidak boleh memiliki item inventory'), { status: 400 });
        }
        if (requestedPartId && unregistered) throw Object.assign(new Error('Pilih part terdaftar atau custom, jangan keduanya'), { status: 400 });
        let part: any = null;
        if (requestedPartId) {
          part = await trx('parts')
            .where({ id: requestedPartId, tenant_id: tenantId, branch_id: ticket.branch_id, is_active: true })
            .first();
          if (!part) throw Object.assign(new Error('Sparepart tidak ditemukan di cabang tiket atau sudah tidak aktif'), { status: 404 });
        }
        const customName = String(line?.requested_name ?? '').trim();
        const customSpecification = String(line?.specification ?? '').trim();
        const customPrice = Number(line?.estimated_price);
        const customArrivalDays = Number(line?.estimated_part_arrival_days);
        if (unregistered && (!customName || customName.length > 200 || !Number.isFinite(customPrice) || customPrice <= 0 ||
          !Number.isSafeInteger(customArrivalDays) || customArrivalDays <= 0 || customSpecification.length > 2000)) {
          throw Object.assign(new Error('Nama, estimasi harga, dan estimasi kedatangan part wajib valid'), { status: 400 });
        }
        if (unregistered) {
          const listedPart = await trx('parts')
            .where({ tenant_id: tenantId, branch_id: ticket.branch_id, is_active: true })
            .whereILike('name', customName)
            .modify((query) => customSpecification ? query.whereILike('spec', customSpecification) : query.whereNull('spec'))
            .first();
          if (listedPart) throw Object.assign(new Error('Sparepart ini sudah ada di master inventory; pilih dari daftar'), { status: 409 });
        }
        if (!part && !unregistered && laborCost <= 0) throw Object.assign(new Error('Item jasa tanpa sparepart wajib memiliki biaya jasa'), { status: 400 });
        const hasPartLine = Boolean(part || unregistered);
        hasPart ||= hasPartLine;
        hasUnregisteredPart ||= unregistered;
        const partName = part?.name ?? (unregistered ? customName : null);
        const partSpecification = part?.spec ?? (unregistered ? customSpecification || null : null);
        const unitPrice = part ? Number(part.sell_price) : unregistered ? customPrice : laborCost;
        const availableQty = part ? Number(part.stock_qty) : unregistered ? 0 : null;
        const etaDays = unregistered ? customArrivalDays : Math.max(1, Number(process.env.ESTIMATED_PART_ARRIVAL_DAYS) || 7);
        const pricing = priceQuotationLine({
          qty: quantity,
          laborCost,
          partUnitPrice: hasPartLine ? unitPrice : null,
          availableQty,
          estimatedPartArrivalDays: etaDays,
        });
        items.push({
          tenant_id: tenantId,
          part_id: part?.id ?? null,
          item_type: hasPartLine ? 'part' : 'labor',
          description: (partName ?? damageDescription).slice(0, 200),
          damage_description: damageDescription,
          part_name_snapshot: partName,
          part_specification_snapshot: partSpecification,
          part_is_registered: !unregistered,
          qty: quantity,
          unit_price: unitPrice,
          subtotal: pricing.subtotal,
          labor_cost: laborCost,
          part_cost: pricing.partCost,
          part_unit_price_snapshot: hasPartLine ? unitPrice : 0,
          availability_status: unregistered ? 'TIDAK_TERSEDIA' : pricing.availabilityStatus,
          available_qty_snapshot: pricing.availableQtySnapshot,
          estimated_part_arrival_days: unregistered ? customArrivalDays : pricing.estimatedPartArrivalDays,
          part_name: partName,
          part_sku: part?.sku ?? null,
        });
      }
      if (diagnosis_status === 'matches_complaint' && !hasPart) {
        throw Object.assign(new Error('Quotation untuk diagnosa sesuai keluhan harus berisi part'), { status: 400 });
      }
      if (diagnosis_status === 'matches_complaint' && !hasUnregisteredPart && items.filter((item) => item.item_type === 'part').length < 2) {
        throw Object.assign(new Error('Quotation untuk diagnosa sesuai keluhan hanya diperlukan untuk part custom atau lebih dari satu part'), { status: 400 });
      }
      if (!items.length) throw Object.assign(new Error('Quotation harus memiliki estimasi sparepart atau jasa'), { status: 400 });

      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      if (!Number.isFinite(total) || total <= 0 || total > 999_999_999_999.99) {
        throw Object.assign(new Error('Total estimasi quotation tidak valid'), { status: 400 });
      }
      const approvalToken = createQuotationToken();
      const approvalTokenHash = hashQuotationToken(approvalToken);
      const expiresAt = new Date(Date.now() + Math.max(1, Number(process.env.QUOTATION_VALIDITY_DAYS) || 7) * 24 * 60 * 60 * 1000);
      const [quotation] = await trx('quotations').insert({
        tenant_id: tenantId,
        ticket_id,
        created_by: req.user?.user_id,
        approval_token_hash: approvalTokenHash,
        technician_diagnosis_snapshot: diagnosis,
        status: 'draft',
        total_amount: total,
        expires_at: expiresAt,
      }).returning('*');

      const insertedItems = [];
      for (const item of items) {
        const { part_name, part_sku, ...row } = item;
        const [inserted] = await trx('quotation_items')
          .insert({ quotation_id: quotation.id, ...row })
          .returning('*');
        insertedItems.push({
          ...inserted,
          part_name,
          part_sku,
        });
      }
      await createPendingPartRequests(trx, {
        tenantId,
        branchId: ticket.branch_id,
        ticketId: ticket_id,
        quotationId: quotation.id,
        requestedBy: req.user!.user_id,
        items: insertedItems,
      });

      const firstPartItem = insertedItems.find((item: any) => item.part_id);
      await trx('service_tickets').where({ id: ticket_id, tenant_id: tenantId, branch_id: ticket.branch_id }).update({
        work_type,
        diagnosis_status,
        technician_diagnosis: diagnosis,
        additional_damage: damage || null,
        requested_part_id: firstPartItem?.part_id ?? null,
        requested_part_qty: firstPartItem?.qty ?? null,
        workflow_resolution: null,
        cancelled_at: null,
        current_status: 'menunggu_persetujuan',
      });
      await trx('ticket_status_logs').insert({
        tenant_id: tenantId,
        ticket_id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status: 'menunggu_persetujuan',
        note: `Quotation ${quotation.id.slice(0, 8)} dikirim untuk persetujuan pelanggan`,
      });
      await logAudit(trx, req, {
        action: 'ticket.assessment_recorded',
        entityType: 'service_ticket',
        entityId: ticket_id,
        oldValues: { current_status: ticket.current_status, work_type: ticket.work_type, diagnosis_status: ticket.diagnosis_status },
        newValues: {
          ticket_code: ticket.ticket_code,
          current_status: 'menunggu_persetujuan',
          work_type,
          diagnosis_status,
          hasil_pemeriksaan_teknisi: diagnosis,
          additional_damage: damage || null,
        },
      });
      await logAudit(trx, req, {
        action: 'quotation.created',
        entityType: 'quotation',
        entityId: quotation.id,
        ticketId: ticket_id,
        newValues: {
          ticket_code: ticket.ticket_code,
          status: quotation.status,
          hasil_pemeriksaan_teknisi: diagnosis,
          hasil_pemeriksaan_teknisi_snapshot: diagnosis,
          total_amount: total,
          items: insertedItems,
        },
      });

      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id: tenantId }).select('phone_wa').first();
      return { quotation, items: insertedItems, ticket, customerPhone: customer?.phone_wa ?? '', approvalToken };
    });

    const notificationInput = {
      tenantId,
      customerId: result.ticket.customer_id,
      phone: result.customerPhone,
      ticketId: result.ticket.id,
      quotationId: result.quotation.id,
      quotationNumber: `QUO-${result.quotation.id.slice(0, 8).toUpperCase()}`,
      totalAmount: Number(result.quotation.total_amount),
      approvalToken: result.approvalToken,
      trackingCode: result.ticket.tracking_code,
      ticketCode: result.ticket.ticket_code,
      complaint: result.ticket.complaint,
      diagnosis,
      expiresAt: result.quotation.expires_at,
      items: result.items,
    };
    const safeQuotation = { ...result.quotation, items: result.items };
    delete safeQuotation.approval_token;
    delete safeQuotation.approval_token_hash;
    const safeTicket = { ...result.ticket };
    delete safeTicket.technician_note;
    res.status(201).json({
      data: {
        ticket: safeTicket,
        quotation: safeQuotation,
        notification_status: 'queued',
        approval_url: null,
      },
    });
    scheduleQuotationDelivery(notificationInput, {
      branchId: result.ticket.branch_id,
      requestedBy: req.user!.user_id,
      items: result.items,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal membuat quotation' });
  }
});

quotationRouter.post('/:id/retry-send', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'ID quotation tidak valid' });
    const token = createQuotationToken();
    const result = await withTenantContext(tenantId, async (trx) => {
      const quote = await trx('quotations').where({ id: req.params.id, tenant_id: tenantId }).forUpdate().first();
      if (!quote) throw Object.assign(new Error('Quotation tidak ditemukan'), { status: 404 });
      if (!['draft', 'sent'].includes(quote.status) || new Date(quote.expires_at).getTime() <= Date.now()) {
        throw Object.assign(new Error('Quotation tidak dapat dikirim ulang karena sudah diputuskan atau kedaluwarsa'), { status: 409 });
      }
      const ticket = await trx('service_tickets').where({ id: quote.ticket_id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!ticket) throw Object.assign(new Error('Tiket quotation tidak ditemukan'), { status: 404 });
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id: tenantId }).select('phone_wa').first();
      const items = await trx('quotation_items as item')
        .leftJoin('parts as part', 'part.id', 'item.part_id')
        .where({ 'item.tenant_id': tenantId, 'item.quotation_id': quote.id })
        .select('item.*', 'part.name as part_name', 'part.sku as part_sku')
        .orderBy('item.created_at', 'asc');
      await trx('quotations').where({ id: quote.id, tenant_id: tenantId }).update({ approval_token_hash: hashQuotationToken(token), status: 'draft' });
      await logAudit(trx, req, {
        action: 'quotation.resend_requested', entityType: 'quotation', entityId: quote.id,
        ticketId: ticket.id,
        oldValues: { status: quote.status }, newValues: { status: 'draft', token_rotated: true },
        note: 'Token approval dirotasi sebelum pengiriman ulang',
      });
      return { quote, ticket, items, phone: customer?.phone_wa ?? '' };
    });
    const notificationInput = {
      tenantId,
      customerId: result.ticket.customer_id,
      phone: result.phone,
      ticketId: result.ticket.id,
      quotationId: result.quote.id,
      quotationNumber: `QUO-${result.quote.id.slice(0, 8).toUpperCase()}`,
      totalAmount: Number(result.quote.total_amount),
      approvalToken: token,
      trackingCode: result.ticket.tracking_code,
      ticketCode: result.ticket.ticket_code,
      complaint: result.ticket.complaint,
      diagnosis: result.quote.technician_diagnosis_snapshot ?? result.ticket.technician_diagnosis ?? '',
      expiresAt: result.quote.expires_at,
      items: result.items,
      dedupeKey: null,
    };
    const quotation = { ...result.quote, status: 'draft' };
    delete quotation.approval_token_hash;
    res.json({ data: { quotation, notification_status: 'queued', approval_url: null } });
    scheduleQuotationDelivery(notificationInput, {
      branchId: result.ticket.branch_id,
      requestedBy: result.quote.created_by ?? req.user!.user_id,
      items: result.items,
    });
    return;
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengirim ulang quotation' });
  }
});

async function endQuotation(req: AuthRequest, res: Response, status: 'cancelled' | 'superseded') {
  try {
    const tenantId = req.user?.tenant_id;
    const reason = String(req.body?.reason ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.id) || !reason || reason.length > 500) return res.status(400).json({ error: 'Alasan wajib diisi (maksimal 500 karakter)' });
    const quote = await withTenantContext(tenantId, async (trx) => {
      const current = await trx('quotations as q')
        .join('service_tickets as ticket', 'ticket.id', 'q.ticket_id')
        .where({ 'q.id': req.params.id, 'q.tenant_id': tenantId, 'ticket.branch_id': req.user?.branch_id })
        .forUpdate()
        .select('q.*')
        .first();
      if (!current) throw Object.assign(new Error('Quotation tidak ditemukan'), { status: 404 });
      if (!['draft', 'sent'].includes(current.status)) throw Object.assign(new Error('Hanya quotation aktif yang dapat dibatalkan atau diganti'), { status: 409 });
      const [updated] = await trx('quotations').where({ id: current.id, tenant_id: tenantId }).update({ status, decided_at: new Date(), decision_note: reason }).returning('*');
      await transitionQuotationPartRequests(trx, {
        tenantId, quotationId: current.id, to: 'CANCELLED', actorId: req.user?.user_id, reason: `Quotation ${status}: ${reason}`,
      });
      await logAudit(trx, req, {
        action: `quotation.${status}`, entityType: 'quotation', entityId: current.id, ticketId: current.ticket_id,
        oldValues: { status: current.status }, newValues: { status, reason }, note: reason,
      });
      return updated;
    });
    delete quote.approval_token;
    delete quote.approval_token_hash;
    return res.json({ data: quote });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || `Gagal ${status} quotation` });
  }
}

quotationRouter.post('/:id/cancel', requireRole('admin'), (req: AuthRequest, res: Response) => endQuotation(req, res, 'cancelled'));
quotationRouter.post('/:id/supersede', requireRole('admin'), (req: AuthRequest, res: Response) => endQuotation(req, res, 'superseded'));

quotationRouter.post('/:id/manual-decision', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const decision = req.body?.decision;
    const note = String(req.body?.note ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.id) || !['approved', 'rejected'].includes(decision) || !note || note.length > 500) {
      return res.status(400).json({ error: 'Keputusan manual dan catatan wajib diisi (maksimal 500 karakter)' });
    }
    const result = await withTenantContext(tenantId, (trx) => decideQuotation(trx, {
      tenantId,
      branchId: req.user?.branch_id,
      quotationId: req.params.id,
      decision,
      note,
      actorId: req.user?.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      manualApproval: true,
    }));
    if (result.expired) return res.status(410).json({ error: 'Quotation sudah kedaluwarsa' });
    await sendDecisionStatusNotification(tenantId, result);
    const quotation = { ...result.quotation };
    delete quotation.approval_token_hash;
    return res.json({ data: { quotation, ticket_status: result.ticketStatus, approval_mode: 'MANUAL' } });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menyimpan keputusan manual' });
  }
});

quotationRouter.post('/:id/cancel', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const reason = String(req.body?.reason ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.id) || !reason || reason.length > 500) return res.status(400).json({ error: 'Alasan pembatalan quotation wajib diisi' });
    const quote = await withTenantContext(tenantId, async (trx) => {
      const current = await trx('quotations').where({ id: req.params.id, tenant_id: tenantId }).forUpdate().first();
      if (!current) throw Object.assign(new Error('Quotation tidak ditemukan'), { status: 404 });
      if (!['draft', 'sent'].includes(current.status)) throw Object.assign(new Error('Quotation yang sudah diputuskan tidak dapat dibatalkan'), { status: 409 });
      const [updated] = await trx('quotations').where({ id: current.id, tenant_id: tenantId }).update({ status: 'cancelled', decision_note: reason, decided_at: new Date() }).returning('*');
      await transitionQuotationPartRequests(trx, { tenantId, quotationId: current.id, to: 'CANCELLED', actorId: req.user?.user_id, reason: `Quotation dibatalkan: ${reason}` });
      await logAudit(trx, req, {
        action: 'quotation.cancelled', entityType: 'quotation', entityId: current.id, ticketId: current.ticket_id,
        oldValues: { status: current.status }, newValues: { status: 'cancelled', reason }, note: reason,
      });
      return updated;
    });
    delete quote.approval_token_hash;
    delete quote.approval_token;
    return res.json({ data: quote });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal membatalkan quotation' });
  }
});

quotationRouter.post('/:id/supersede', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const reason = String(req.body?.reason ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.id) || !reason || reason.length > 500) return res.status(400).json({ error: 'Alasan supersede quotation wajib diisi' });
    const quote = await withTenantContext(tenantId, async (trx) => {
      const current = await trx('quotations').where({ id: req.params.id, tenant_id: tenantId }).forUpdate().first();
      if (!current) throw Object.assign(new Error('Quotation tidak ditemukan'), { status: 404 });
      if (!['draft', 'sent'].includes(current.status)) throw Object.assign(new Error('Hanya quotation aktif yang dapat digantikan'), { status: 409 });
      const [updated] = await trx('quotations').where({ id: current.id, tenant_id: tenantId }).update({ status: 'superseded', decision_note: reason, decided_at: new Date() }).returning('*');
      await transitionQuotationPartRequests(trx, { tenantId, quotationId: current.id, to: 'CANCELLED', actorId: req.user?.user_id, reason: `Quotation digantikan: ${reason}` });
      await logAudit(trx, req, {
        action: 'quotation.superseded', entityType: 'quotation', entityId: current.id, ticketId: current.ticket_id,
        oldValues: { status: current.status }, newValues: { status: 'superseded', reason }, note: reason,
      });
      return updated;
    });
    delete quote.approval_token_hash;
    delete quote.approval_token;
    return res.json({ data: quote });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengganti quotation' });
  }
});

async function sendDecisionStatusNotification(tenantId: string, result: any) {
  if (!result.customerPhone || result.ticket.current_status === result.ticketStatus) return;
  const notification = await notifyTicketStatusChanged({
    tenantId,
    customerId: result.ticket.customer_id,
    phone: result.customerPhone,
    ticketId: result.ticket.id,
    trackingCode: result.ticket.tracking_code,
    previousStatus: result.ticket.current_status,
    status: result.ticketStatus,
    details: result.partShortages?.map((part: any) => `${part.part_name}: kurang ${part.shortage_qty} (tersedia ${part.available_qty}/${part.required_qty})${part.estimated_arrival_days ? ` · estimasi ${part.estimated_arrival_days} hari` : ''}`).join('\n'),
  });
  await withTenantContext(tenantId, (trx) => trx('audit_logs').insert({
    tenant_id: tenantId, user_id: null, action: 'ticket.status_notification', entity_type: 'service_ticket',
    entity_id: result.ticket.id, ticket_id: result.ticket.id, quotation_id: result.quotation.id,
    notification_id: 'id' in notification ? notification.id : null, actor_type: 'system',
    new_values: { status: result.ticketStatus, notification_status: notification.status, provider_message_id: 'providerMessageId' in notification ? notification.providerMessageId ?? null : null },
  }));
}

quotationRouter.post('/:id/:decision(approve|reject)', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const result = await withTenantContext(tenantId, (trx) => decideQuotation(trx, {
      tenantId,
      branchId: req.user?.branch_id,
      quotationId: req.params.id,
      decision: req.params.decision === 'approve' ? 'approved' : 'rejected',
      note: req.body?.note,
      actorId: req.user?.user_id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }));
    if (result.expired) {
      res.status(410).json({ error: 'Tautan persetujuan quotation sudah kedaluwarsa' });
      return;
    }
    await sendDecisionStatusNotification(tenantId, result);
    const safeQuotation = { ...result.quotation };
    delete safeQuotation.approval_token;
    delete safeQuotation.approval_token_hash;
    res.json({ data: { quotation: safeQuotation, ticket_status: result.ticketStatus } });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal memproses quotation' });
  }
});

quotationRouter.post('/:id/resolve-rejection', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { ticket_id, action } = req.body ?? {};
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    if (!isUuid(ticket_id) || !['continue_original', 'cancel_and_return'].includes(action)) {
      res.status(400).json({ error: 'Pilihan penyelesaian quotation tidak valid' });
      return;
    }
    const result = await withTenantContext(tenantId, (trx) => resolveRejectedQuotation(trx, {
      tenantId,
      branchId: req.user!.branch_id!,
      ticketId: ticket_id,
      quotationId: req.params.id,
      action,
      actorId: req.user!.user_id,
      ipAddress: req.ip,
    }));
    res.json({ data: result });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal menyelesaikan quotation ditolak' });
  }
});
