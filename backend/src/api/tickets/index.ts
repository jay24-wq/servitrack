import { Router, Response } from 'express';
import db from '@models/index';
import { authMiddleware, AuthRequest, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { generateTicketCode, generateTrackingCode, generateTrackingToken } from '@utils/code';
import { logBookingEvent } from '@repositories/bookingTimelineRepo';
import { notifyTicketCreated, notifyTicketStatusChanged } from '@services/notifications/events';
import { findActiveTechnician } from '@repositories/ticketAssignmentRepo';
import {
  getTechnicianWorkload,
  logAutomaticAssignment,
  logExplicitAssignment,
  pickAutoTechnician,
} from '@services/ticketAssignmentService';
import { statusRouter } from './status';
import { notesRouter } from './notes';
import { photosRouter } from './photos';

export const ticketRouter = Router();

ticketRouter.use(authMiddleware);
ticketRouter.use(tenantResolver);
ticketRouter.use(statusRouter);
ticketRouter.use(notesRouter);
ticketRouter.use(photosRouter);

// GET /api/tickets - List service tickets
ticketRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const tickets = await reqDb(req)('service_tickets as t')
      .where('t.tenant_id', tenant_id)
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .leftJoin('users as u', 'u.id', 't.technician_id')
      .leftJoin('bookings as b', 'b.id', 't.booking_id')
      .select(
        't.*',
        'b.booking_code',
        'c.name as customer_name',
        'c.phone_wa as customer_phone',
        db.raw("concat_ws(' ', d.brand, d.model) as device_label"),
        'u.name as technician_name',
        db.raw(`
          upper(
            concat(
              left(split_part(u.name, ' ', 1), 1),
              left(split_part(u.name, ' ', 2), 1)
            )
          ) as technician_initials
        `)
      )
      .orderBy('t.created_at', 'desc');
    res.json({ data: tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data tiket' });
  }
});

// GET /api/tickets/technician/dashboard - data personal teknisi login
ticketRouter.get('/technician/dashboard', requireRole('teknisi'), async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const technician_id = req.user?.user_id;
    if (!tenant_id || !technician_id) {
      res.status(401).json({ error: 'Identitas tenant atau teknisi tidak ditemukan' });
      return;
    }

    const search = String(req.query.search || '').trim();
    const query = reqDb(req);
    const assigned = query('service_tickets as t')
      .where({ 't.tenant_id': tenant_id, 't.technician_id': technician_id })
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .modify((builder) => {
        if (search) {
          builder.where((filter) => filter
            .whereILike('t.ticket_code', `%${search}%`)
            .orWhereILike('t.tracking_code', `%${search}%`)
            .orWhereILike('d.serial_number', `%${search}%`)
            .orWhereILike('d.brand', `%${search}%`)
            .orWhereILike('d.model', `%${search}%`)
            .orWhereILike('c.name', `%${search}%`));
        }
      });

    const tickets = await assigned
      .clone()
      .select(
        't.id',
        't.ticket_code',
        't.tracking_code',
        't.technician_id',
        't.current_status',
        't.complaint',
        't.service_method',
        't.estimated_done_at',
        't.completed_at',
        't.created_at',
        'c.name as customer_name',
        'c.phone_wa as customer_phone',
        'd.serial_number',
        query.raw("concat_ws(' ', d.brand, d.model) as device_label")
      )
      .orderBy('t.created_at', 'desc');

    const [stats] = await query('service_tickets as t')
      .where({ 't.tenant_id': tenant_id, 't.technician_id': technician_id })
      .select(query.raw(`
        COUNT(*) FILTER (WHERE t.current_status = 'antrian') AS antrean,
        COUNT(*) FILTER (
          WHERE (t.estimated_done_at AT TIME ZONE 'Asia/Makassar')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        ) AS prioritas,
        COUNT(*) FILTER (WHERE t.current_status = 'menunggu_part') AS menunggu_part,
        COUNT(*) FILTER (
          WHERE t.current_status IN ('selesai', 'siap_diambil')
            AND (t.completed_at AT TIME ZONE 'Asia/Makassar')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        ) AS selesai
      `));

    res.json({
      data: {
        stats: {
          antrean: Number(stats?.antrean || 0),
          prioritas: Number(stats?.prioritas || 0),
          menunggu_part: Number(stats?.menunggu_part || 0),
          selesai: Number(stats?.selesai || 0),
        },
        tickets,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil dashboard teknisi' });
  }
});

// GET /api/tickets/technicians/workload - Active workload per technician
ticketRouter.get('/technicians/workload', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const workload = await getTechnicianWorkload(reqDb(req), tenant_id);
    const totalActive = workload.reduce((sum, technician) => sum + technician.active_count, 0);
    const topTechnician = [...workload].sort(
      (a, b) => b.total_count - a.total_count || a.name.localeCompare(b.name)
    )[0] ?? null;

    res.json({
      data: workload,
      summary: {
        total_active: totalActive,
        total_technicians: workload.length,
        busiest_technician: topTechnician,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil beban kerja teknisi' });
  }
});

// GET /api/tickets/:id - Detail ticket
ticketRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    const query = reqDb(req);
    const ticket = await query('service_tickets').where({ id, tenant_id }).first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const photos = await query('ticket_photos').where({ ticket_id: id, tenant_id });
    const notes = await query('ticket_notes').where({ ticket_id: id, tenant_id });
    const statusLogs = await query('ticket_status_logs').where({ ticket_id: id, tenant_id });
    const assignmentLogs = await query('ticket_assignment_logs')
      .where({ ticket_id: id, tenant_id })
      .orderBy('created_at', 'desc');

    res.json({ data: { ...ticket, photos, notes, statusLogs, assignmentLogs } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil detail tiket' });
  }
});

// POST /api/tickets - Create service ticket (convert from booking or manual/walk-in)
ticketRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const {
      branch_id,
      booking_id,
      customer_id,
      device_id,
      technician_id,
      problem,
      complaint,
      service_method,
      owner_id_type,
      owner_id_number,
      initial_estimate_cost,
      // Walk-in: data pelanggan & perangkat dibuat otomatis bila id belum ada
      customer_name,
      customer_phone,
      device_category,
      device_brand,
      device_model,
      device_serial,
    } = req.body;

    if (!service_method) {
      res.status(400).json({ error: 'service_method wajib diisi' });
      return;
    }

    let normalizedInitialEstimate: number | null = null;
    if (initial_estimate_cost !== undefined && initial_estimate_cost !== null && initial_estimate_cost !== '') {
      const parsed = Number(initial_estimate_cost);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: 'initial_estimate_cost tidak boleh negatif' });
        return;
      }
      normalizedInitialEstimate = parsed;
    }

    const requestedTechnicianId =
      typeof technician_id === 'string' && technician_id.trim() ? technician_id.trim() : null;

    const result = await withTenantContext(tenant_id, async (trx) => {
      let booking: any = null;
      if (booking_id) {
        booking = await trx('bookings').where({ id: booking_id, tenant_id }).first();
        if (!booking) throw Object.assign(new Error('Booking tidak ditemukan'), { status: 404 });

        const existing = await trx('service_tickets').where({ booking_id: booking.id, tenant_id }).first();
        if (existing) {
          throw Object.assign(new Error(`Booking ini sudah dibuatkan tiket ${existing.ticket_code}`), { status: 409 });
        }
      }

      let resolvedBranchId = branch_id || booking?.branch_id;
      if (!resolvedBranchId) {
        const branch =
          (await trx('branches').where({ tenant_id, is_main: true }).first()) ??
          (await trx('branches').where({ tenant_id }).orderBy('created_at', 'asc').first());
        resolvedBranchId = branch?.id;
      }
      if (!resolvedBranchId) {
        throw Object.assign(new Error('Cabang tidak ditemukan untuk tenant ini'), { status: 400 });
      }

      // Pelanggan: pakai dari booking/id, atau cari/buat berdasarkan nomor WA
      let resolvedCustomerId = customer_id || booking?.customer_id;
      if (!resolvedCustomerId) {
        const phone = String(customer_phone || '').trim();
        const name = String(customer_name || '').trim();
        if (!phone) throw Object.assign(new Error('customer_phone wajib diisi'), { status: 400 });

        const existingCustomer = await trx('customers').where({ tenant_id, phone_wa: phone }).first();
        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          if (!name) throw Object.assign(new Error('customer_name wajib diisi untuk pelanggan baru'), { status: 400 });
          const [created] = await trx('customers').insert({ tenant_id, name, phone_wa: phone }).returning('*');
          resolvedCustomerId = created.id;
        }
      }

      // Perangkat: pakai dari booking/id, atau cari/buat berdasarkan nomor seri
      let resolvedDeviceId = device_id || booking?.device_id;
      if (!resolvedDeviceId) {
        const serial = String(device_serial || '').trim();
        let device = serial
          ? await trx('devices').where({ tenant_id, customer_id: resolvedCustomerId, serial_number: serial }).first()
          : null;
        if (!device) {
          const model = String(device_model || '').trim();
          [device] = await trx('devices')
            .insert({
              tenant_id,
              customer_id: resolvedCustomerId,
              category: String(device_category || 'lainnya').slice(0, 30),
              brand: String(device_brand || model || '-').slice(0, 50),
              model: model || null,
              serial_number: serial || null,
            })
            .returning('*');
        }
        resolvedDeviceId = device.id;
      }

      const requestedTechnician = requestedTechnicianId
        ? await findActiveTechnician(trx, tenant_id, requestedTechnicianId)
        : null;
      if (requestedTechnicianId && !requestedTechnician) {
        throw Object.assign(new Error('Teknisi tidak ditemukan atau tidak aktif'), { status: 400 });
      }

      const autoTechnician = requestedTechnician ? null : await pickAutoTechnician(trx, tenant_id);
      const assignedTechnician = requestedTechnician ?? autoTechnician;
      const assignedAt = assignedTechnician ? new Date() : null;

      const [ticket] = await trx('service_tickets')
        .insert({
          tenant_id,
          branch_id: resolvedBranchId,
          booking_id: booking?.id ?? null,
          customer_id: resolvedCustomerId,
          device_id: resolvedDeviceId,
          received_by: req.user?.user_id,
          technician_id: assignedTechnician?.id ?? null,
          assignment_type: requestedTechnician ? 'MANUAL' : autoTechnician ? 'AUTO' : null,
          assigned_at: assignedAt,
          assigned_by: requestedTechnician ? req.user?.user_id ?? null : null,
          ticket_code: generateTicketCode(),
          tracking_code: booking?.tracking_code ?? generateTrackingCode(),
          tracking_token: generateTrackingToken(),
          service_method: booking?.service_method ?? service_method,
          owner_id_type: owner_id_type || null,
          owner_id_number_enc: owner_id_number || null,
           complaint: complaint || problem || booking?.complaint || '',
           current_status: 'antrian',
           initial_estimate_cost: normalizedInitialEstimate,
         })
        .returning('*');

      if (autoTechnician) {
        await logAutomaticAssignment(trx, {
          tenantId: tenant_id,
          ticketId: ticket.id,
          technician: autoTechnician,
        });
      }

      if (requestedTechnician) {
        await logExplicitAssignment(trx, {
          tenantId: tenant_id,
          ticketId: ticket.id,
          technician: requestedTechnician,
          assignedBy: req.user?.user_id,
          actorName: req.user?.name,
          actorRole: req.user?.role,
        });
      }

      if (booking) {
        // Timeline: Unit Diterima Cabang (hanya bila belum tercatat sebelumnya)
        if (booking.status !== 'arrived') {
          await logBookingEvent(
            {
              tenant_id,
              booking_id: booking.id,
              event_code: 'UNIT_RECEIVED',
              from_status: booking.status,
              to_status: 'arrived',
              actor_id: req.user?.user_id ?? null,
              actor_type: 'frontdesk',
              note: 'Unit diterima cabang',
              meta: { booking_code: booking.booking_code },
            },
            trx
          );
        }

        await trx('bookings').where({ id: booking.id }).update({ status: 'arrived' });

        // Timeline: Tiket Servis Diterbitkan
        await logBookingEvent(
          {
            tenant_id,
            booking_id: booking.id,
            event_code: 'TICKET_ISSUED',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: 'Tiket servis diterbitkan',
            meta: { ticket_id: ticket.id, ticket_code: ticket.ticket_code },
          },
          trx
        );
      }

      // Catat status awal
      await trx('ticket_status_logs').insert({
        tenant_id,
        ticket_id: ticket.id,
        changed_by: req.user?.user_id,
        to_status: 'antrian',
        note: booking ? 'Tiket dibuat dari booking' : 'Tiket walk-in dibuat',
      });

       const customer = await trx('customers').where({ id: resolvedCustomerId, tenant_id }).select('phone_wa').first();
       return {
         ...ticket,
         technician_name: assignedTechnician?.name ?? null,
         customerPhone: customer?.phone_wa ?? '',
       };
     });

    void notifyTicketCreated({
      tenantId: tenant_id,
      customerId: result.customer_id,
      phone: result.customerPhone,
      ticketId: result.id,
      ticketCode: result.ticket_code,
      trackingCode: result.tracking_code,
    });

    res.status(201).json({ message: 'Tiket servis berhasil dibuat', data: result });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal membuat tiket' });
  }
});

// PUT /api/tickets/:id/status - Update ticket status
ticketRouter.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { to_status, note } = req.body;

    if (!to_status) {
      res.status(400).json({ error: 'to_status wajib diisi' });
      return;
    }

    const ticket = await reqDb(req)('service_tickets').where({ id, tenant_id }).first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const valid = ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil'];
    if (!valid.includes(to_status)) {
      res.status(400).json({ error: 'Status tidak valid' });
      return;
    }

    const customer = await reqDb(req)('customers').where({ id: ticket.customer_id, tenant_id }).select('phone_wa').first();
    await withTenantContext(tenant_id!, async (trx) => {
      await trx('service_tickets').where({ id }).update({ current_status: to_status });
      await trx('ticket_status_logs').insert({
        tenant_id: tenant_id!,
        ticket_id: id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status,
        note: note || null,
      });
    });

    if (ticket.current_status !== to_status) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id!,
        customerId: ticket.customer_id,
        phone: customer?.phone_wa ?? '',
        ticketId: ticket.id,
        trackingCode: ticket.tracking_code,
        status: to_status,
      });
    }

    res.json({ message: 'Status tiket berhasil diperbarui' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui status tiket' });
  }
});

// POST /api/tickets/:id/close - Close ticket (validasi invoice paid + parts recorded)
ticketRouter.post('/:id/close', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const { id } = req.params;
    const { to_status } = req.body;
    const finalStatus = to_status === 'selesai' || to_status === 'siap_diambil' ? to_status : 'selesai';

    const notification = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets').where({ id, tenant_id }).first();
      if (!ticket) throw new Error('Tiket tidak ditemukan');

      const invoice = await trx('invoices').where({ ticket_id: id, tenant_id }).first();
      if (!invoice) throw new Error('Invoice belum ada, tiket tidak bisa ditutup');
      if (invoice.status !== 'paid') throw new Error('Invoice belum paid, tiket tidak bisa ditutup');

      const pendingQuotation = await trx('quotations').where({ ticket_id: id, tenant_id }).whereNot({ status: 'approved' }).first();
      if (pendingQuotation) throw new Error('Masih ada quotation pending');

      await trx('service_tickets').where({ id }).update({ current_status: finalStatus, completed_at: new Date(), closed_by: req.user?.user_id });

      await trx('ticket_status_logs').insert({
        tenant_id,
        ticket_id: id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status: finalStatus,
        note: 'Tiket ditutup',
      });
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id }).select('phone_wa').first();
      return { ticket, customerPhone: customer?.phone_wa ?? '' };
    });

    if (notification.ticket.current_status !== finalStatus) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id,
        customerId: notification.ticket.customer_id,
        phone: notification.customerPhone,
        ticketId: notification.ticket.id,
        trackingCode: notification.ticket.tracking_code,
        status: finalStatus,
      });
    }

    res.json({ message: 'Tiket berhasil ditutup' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Gagal menutup tiket' });
  }
});

// POST /api/tickets/:id/notes - Add note
ticketRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { note_type, content } = req.body;

    if (!note_type || !content) {
      res.status(400).json({ error: 'note_type dan content wajib diisi' });
      return;
    }

    const ticket = await reqDb(req)('service_tickets').where({ id, tenant_id }).first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const [note] = await withTenantContext(tenant_id!, async (trx) => {
      return trx('ticket_notes')
        .insert({
          tenant_id: tenant_id!,
          ticket_id: id,
          author_id: req.user?.user_id,
          note_type,
          content,
        })
        .returning('*');
    }).then((rows) => rows as any[]);

    res.status(201).json({ data: note });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambah catatan' });
  }
});
