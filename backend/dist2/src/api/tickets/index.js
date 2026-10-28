import { Router } from 'express';
import db from '@models/index';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
import { generateTicketCode, generateTrackingToken } from '@utils/code';
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
ticketRouter.get('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const tickets = await db('service_tickets')
            .where({ tenant_id })
            .orderBy('created_at', 'desc');
        res.json({ data: tickets });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil data tiket' });
    }
});
// GET /api/tickets/:id - Detail ticket
ticketRouter.get('/:id', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const ticket = await db('service_tickets').where({ id, tenant_id }).first();
        if (!ticket) {
            res.status(404).json({ error: 'Tiket tidak ditemukan' });
            return;
        }
        const photos = await db('ticket_photos').where({ ticket_id: id, tenant_id });
        const notes = await db('ticket_notes').where({ ticket_id: id, tenant_id });
        const statusLogs = await db('ticket_status_logs').where({ ticket_id: id, tenant_id });
        res.json({ data: { ...ticket, photos, notes, statusLogs } });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil detail tiket' });
    }
});
// POST /api/tickets - Create service ticket (convert from booking or manual/walk-in)
ticketRouter.post('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { branch_id, booking_id, customer_id, device_id, technician_id, problem, complaint, service_method, owner_id_type, owner_id_number } = req.body;
        if (!branch_id || !customer_id || !device_id || !service_method) {
            res.status(400).json({ error: 'branch_id, customer_id, device_id, service_method wajib diisi' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            let ticket;
            if (booking_id) {
                // Convert booking to ticket
                const booking = await trx('bookings').where({ id: booking_id, tenant_id }).first();
                if (!booking) {
                    throw new Error('Booking tidak ditemukan');
                }
                [ticket] = await trx('service_tickets')
                    .insert({
                    tenant_id,
                    branch_id: booking.branch_id,
                    booking_id: booking.id,
                    customer_id: booking.customer_id,
                    device_id: booking.device_id,
                    received_by: req.user?.user_id,
                    technician_id: technician_id || null,
                    ticket_code: generateTicketCode(),
                    tracking_token: generateTrackingToken(),
                    service_method: booking.service_method,
                    owner_id_type: owner_id_type || null,
                    owner_id_number_enc: owner_id_number || null,
                    complaint: booking.complaint || complaint || '',
                    current_status: 'antrian',
                })
                    .returning('*');
                // Update booking status jika perlu (misal arrived/done converted)
            }
            else {
                // Walk-in ticket
                [ticket] = await trx('service_tickets')
                    .insert({
                    tenant_id,
                    branch_id,
                    booking_id: null,
                    customer_id,
                    device_id,
                    received_by: req.user?.user_id,
                    technician_id: technician_id || null,
                    ticket_code: generateTicketCode(),
                    tracking_token: generateTrackingToken(),
                    service_method,
                    owner_id_type: owner_id_type || null,
                    owner_id_number_enc: owner_id_number || null,
                    complaint: complaint || problem || '',
                    current_status: 'antrian',
                })
                    .returning('*');
            }
            // Catat status awal
            await trx('ticket_status_logs').insert({
                tenant_id,
                ticket_id: ticket.id,
                changed_by: req.user?.user_id,
                to_status: 'antrian',
                note: booking_id ? 'Tiket dibuat dari booking' : 'Tiket walk-in dibuat',
            });
            return ticket;
        });
        res.status(201).json({ message: 'Tiket servis berhasil dibuat', data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal membuat tiket' });
    }
});
// PUT /api/tickets/:id/status - Update ticket status
ticketRouter.put('/:id/status', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const { to_status, note } = req.body;
        if (!to_status) {
            res.status(400).json({ error: 'to_status wajib diisi' });
            return;
        }
        const ticket = await db('service_tickets').where({ id, tenant_id }).first();
        if (!ticket) {
            res.status(404).json({ error: 'Tiket tidak ditemukan' });
            return;
        }
        const valid = ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil'];
        if (!valid.includes(to_status)) {
            res.status(400).json({ error: 'Status tidak valid' });
            return;
        }
        await withTenantContext(tenant_id, async (trx) => {
            await trx('service_tickets').where({ id }).update({ current_status: to_status });
            await trx('ticket_status_logs').insert({
                tenant_id: tenant_id,
                ticket_id: id,
                changed_by: req.user?.user_id,
                from_status: ticket.current_status,
                to_status,
                note: note || null,
            });
        });
        res.json({ message: 'Status tiket berhasil diperbarui' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memperbarui status tiket' });
    }
});
// POST /api/tickets/:id/close - Close ticket (validasi invoice paid + parts recorded)
ticketRouter.post('/:id/close', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { id } = req.params;
        const { to_status } = req.body;
        const finalStatus = to_status === 'selesai' || to_status === 'siap_diambil' ? to_status : 'selesai';
        await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id, tenant_id }).first();
            if (!ticket)
                throw new Error('Tiket tidak ditemukan');
            const invoice = await trx('invoices').where({ ticket_id: id, tenant_id }).first();
            if (!invoice)
                throw new Error('Invoice belum ada, tiket tidak bisa ditutup');
            if (invoice.status !== 'paid')
                throw new Error('Invoice belum paid, tiket tidak bisa ditutup');
            const pendingQuotation = await trx('quotations').where({ ticket_id: id, tenant_id }).whereNot({ status: 'approved' }).first();
            if (pendingQuotation)
                throw new Error('Masih ada quotation pending');
            await trx('service_tickets').where({ id }).update({ current_status: finalStatus, completed_at: new Date(), closed_by: req.user?.user_id });
            await trx('ticket_status_logs').insert({
                tenant_id,
                ticket_id: id,
                changed_by: req.user?.user_id,
                from_status: ticket.current_status,
                to_status: finalStatus,
                note: 'Tiket ditutup',
            });
        });
        res.json({ message: 'Tiket berhasil ditutup' });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Gagal menutup tiket' });
    }
});
// POST /api/tickets/:id/notes - Add note
ticketRouter.post('/:id/notes', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const { note_type, content } = req.body;
        if (!note_type || !content) {
            res.status(400).json({ error: 'note_type dan content wajib diisi' });
            return;
        }
        const ticket = await db('service_tickets').where({ id, tenant_id }).first();
        if (!ticket) {
            res.status(404).json({ error: 'Tiket tidak ditemukan' });
            return;
        }
        const [note] = await withTenantContext(tenant_id, async (trx) => {
            return trx('ticket_notes')
                .insert({
                tenant_id: tenant_id,
                ticket_id: id,
                author_id: req.user?.user_id,
                note_type,
                content,
            })
                .returning('*');
        }).then((rows) => rows);
        res.status(201).json({ data: note });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menambah catatan' });
    }
});
//# sourceMappingURL=index.js.map