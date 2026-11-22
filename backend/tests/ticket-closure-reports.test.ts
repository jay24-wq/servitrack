import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import app from '../src/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app';
import { createQuotationToken, hashQuotationToken } from '../src/utils/quotationToken';
import { setNotificationProviderForTests } from '../src/services/notifications/notificationService';

describe('Ticket Closure, Dashboard, Export', () => {
  let tenantId: string;
  let branchId: string;
  let userId: string;
  let customerId: string;
  let deviceId: string;
  let token: string;
  let technicianToken: string;
  let lastApprovalUrl = '';

  const insertTicket = async (status: string, fields: Record<string, unknown> = {}) => db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
    const [ticket] = await trx('service_tickets').insert({
      tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId, received_by: userId,
      ticket_code: 'SRV' + uuidv4().replace(/-/g, '').slice(0, 12),
      tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff', complaint: 'tes workflow', current_status: status,
      ...fields,
    }).returning('id');
    return ticket.id as string;
  });

  const insertPart = async (stock: number, sellPrice = 100_000) => db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
    const [part] = await trx('parts').insert({
      tenant_id: tenantId, branch_id: branchId, sku: 'WF-' + uuidv4().slice(0, 8), name: 'Part workflow', unit: 'pcs',
      stock_qty: stock, min_stock: 0, cost_price: sellPrice / 2, sell_price: sellPrice,
    }).returning('id');
    return part.id as string;
  });

  const withFakeWhatsApp = async (run: () => Promise<void>) => {
    lastApprovalUrl = '';
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({ channels: { whatsapp: true, email: false, in_app: false } });
    });
    setNotificationProviderForTests({
      sendTextMessage: async () => ({ providerMessageId: `test-${uuidv4()}` }),
      sendTemplateMessage: async (_tenantId, _phone, _template, variables) => {
        if (typeof variables.approvalLink === 'string') lastApprovalUrl = variables.approvalLink;
        return { providerMessageId: `test-${uuidv4()}` };
      },
      healthCheck: async () => true,
    });
    try {
      await run();
    } finally {
      setNotificationProviderForTests(null);
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({ channels: { whatsapp: false, email: false, in_app: false } });
      });
    }
  };

  const waitForQuotationStatus = async (quotationId: string, status: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const quotation = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('quotations').where({ id: quotationId }).first();
      });
      if (quotation?.status === status) return quotation;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Quotation ${quotationId} tidak mencapai status ${status}`);
  };

  const waitForNotification = async (quotationId: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const notification = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('notification_logs').where({ quotation_id: quotationId }).orderBy('created_at', 'desc').first();
      });
      if (notification?.status === 'sent' || notification?.status === 'failed') return notification;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Notifikasi quotation ${quotationId} belum selesai`);
  };

  const withUnconfiguredWhatsApp = async (run: () => Promise<void>) => {
    const envNames = ['NODE_ENV', 'OPENWA_BASE_URL', 'OPENWA_API_KEY', 'PUBLIC_APP_URL'] as const;
    const originalEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({ channels: { whatsapp: true, email: false, in_app: false } });
    });
    setNotificationProviderForTests(null);
    process.env.NODE_ENV = 'development';
    for (const key of envNames.slice(1, 3)) delete process.env[key];
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    try {
      await run();
    } finally {
      for (const key of envNames) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
      }
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({ channels: { whatsapp: false, email: false, in_app: false } });
      });
    }
  };

  beforeAll(async () => {
    const eff = process.env.DB_TEST_NAME || process.env.DB_NAME || '';
    if (!eff.endsWith('_test')) throw new Error('Guard DB not _test');
    const r = await db.raw("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
    const { rolsuper, rolbypassrls } = r.rows[0];
    if (rolsuper || rolbypassrls) throw new Error('Guard superuser');

    tenantId = uuidv4();
    const slug = 'close-' + tenantId.slice(0, 8);
    const pass = await bcrypt.hash('pass123', 10);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [t] = await trx('tenants').insert({ id: tenantId, name: 'Close Tenant', slug, owner_name: 'O', phone: '1' }).returning('id');
      tenantId = t.id;
      const [b] = await trx('branches').insert({ tenant_id: tenantId, name: 'Cabang', is_main: true }).returning('id');
      branchId = b.id;
      const role = await trx('roles').where({ code: 'admin' }).first();
      const [u] = await trx('users').insert({ tenant_id: tenantId, branch_id: branchId, role_id: role.id, name: 'Admin', email: 'admin@close.test', password_hash: pass }).returning('id');
      userId = u.id;
      const technicianRole = await trx('roles').where({ code: 'teknisi' }).first();
      const [technician] = await trx('users').insert({ tenant_id: tenantId, branch_id: branchId, role_id: technicianRole.id, name: 'Teknisi', email: 'tech@close.test', password_hash: pass }).returning('id');
      const [c] = await trx('customers').insert({ tenant_id: tenantId, name: 'Cust', phone_wa: '081' }).returning('id');
      customerId = c.id;
      const [d] = await trx('devices').insert({ tenant_id: tenantId, customer_id: customerId, category: 'hp', model: 'X' }).returning('id');
      deviceId = d.id;
      await trx('tenant_notification_settings').insert({ tenant_id: tenantId, channels: { whatsapp: false, email: false, in_app: false } })
        .onConflict('tenant_id').merge({ channels: { whatsapp: false, email: false, in_app: false } });
    });
    token = jwt.sign({ user_id: userId, tenant_id: tenantId, branch_id: branchId, role: 'admin', email: 'admin@close.test' }, appConfig.jwtSecret, { expiresIn: '1h' });
    const technician = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('users').where({ tenant_id: tenantId, email: 'tech@close.test' }).select('id').first();
    });
    technicianToken = jwt.sign({ user_id: technician.id, tenant_id: tenantId, branch_id: branchId, role: 'teknisi', email: 'tech@close.test' }, appConfig.jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    for (const tid of [tenantId].filter(Boolean)) {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tid]);
        await trx('ticket_status_logs').delete();
        await trx('payments').delete();
        await trx('invoices').delete();
        await trx('ticket_part_usages').delete();
        await trx('notification_logs').delete();
        await trx('part_requests').delete();
        await trx('quotation_items').delete();
        await trx('quotations').delete();
        await trx('part_stock_movements').where({ movement_type: 'reversal' }).delete();
        await trx('part_stock_movements').delete();
        await trx('service_tickets').delete();
        await trx('bookings').delete();
        await trx('booking_slots').delete();
        await trx('parts').delete();
        await trx('audit_logs').where({ tenant_id: tid }).delete();
        await trx('devices').delete();
        await trx('customers').delete();
        await trx('users').delete();
        await trx('branches').delete();
        await trx('tenant_notification_settings').delete();
        await trx('tenants').delete();
      }).catch(() => {});
    }
    await db.destroy();
  });

  it('tiket tidak bisa ditutup jika invoice belum paid (400)', async () => {
    const ticketId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [t] = await trx('service_tickets').insert({ tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId, received_by: userId, ticket_code: 'SRV-' + Date.now().toString().slice(-12).padStart(12, '0'), tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff', complaint: 'rusak', current_status: 'antrian' }).returning('id');
      await trx('ticket_status_logs').insert({ tenant_id: tenantId, ticket_id: t.id, changed_by: userId, to_status: 'antrian' });
      await trx('invoices').insert({ tenant_id: tenantId, ticket_id: t.id, invoice_no: 'INV-' + t.id.slice(0, 8), subtotal: 100000, total: 100000, status: 'unpaid' });
      return t.id;
    });
    const res = await request(app).post("/api/tickets/" + ticketId + "/close").set('Authorization', "Bearer " + token).send({ to_status: 'selesai' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invoice belum paid/);
  });

  it('blocks device handover until the invoice has a full successful payment and records who handed it over', async () => {
    const ticketId = await insertTicket('selesai');
    const [invoice] = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('invoices').insert({ tenant_id: tenantId, ticket_id: ticketId, invoice_no: `INV-HO-${uuidv4().slice(0, 8)}`, subtotal: 100_000, total: 100_000, status: 'unpaid' }).returning('id');
    });

    const blocked = await request(app).post(`/api/payments/${invoice.id}/handover`).set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(409);

    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('payments').insert({ tenant_id: tenantId, invoice_id: invoice.id, received_by: userId, method: 'cash', amount: 100_000, status: 'paid', is_full_settlement: true, idempotency_key: `handover-${uuidv4()}`, paid_at: new Date() });
      await trx('invoices').where({ id: invoice.id }).update({ status: 'paid' });
    });
    const completed = await request(app).post(`/api/payments/${invoice.id}/handover`).set('Authorization', `Bearer ${token}`);
    expect(completed.status).toBe(200);
    const ticket = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: ticketId }).first();
    });
    expect(ticket.handed_over_by).toBe(userId);
    expect(ticket.handed_over_at).toBeTruthy();
  });

  it('records exact cash settlement, calculates change, rejects a partial amount, and replays idempotently', async () => {
    const ticketId = await insertTicket('selesai');
    const [invoice] = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('invoices').insert({ tenant_id: tenantId, ticket_id: ticketId, invoice_no: `INV-CASH-${uuidv4().slice(0, 8)}`, subtotal: 100_000, total: 100_000, status: 'unpaid' }).returning('id');
    });

    const amountMismatch = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({ invoice_id: invoice.id, method: 'cash', amount: 90_000, cash_received: 100_000, idempotency_key: `wrong-${uuidv4()}` });
    expect(amountMismatch.status).toBe(400);
    expect(amountMismatch.body.error).toMatch(/sama dengan total invoice/);
    const missingReference = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({ invoice_id: invoice.id, method: 'edc', amount: 100_000, idempotency_key: `edc-${uuidv4()}` });
    expect(missingReference.status).toBe(400);

    const key = `cash-${uuidv4()}`;
    const paid = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({ invoice_id: invoice.id, method: 'cash', amount: 100_000, cash_received: 150_000, idempotency_key: key });
    expect(paid.status).toBe(201);
    expect(Number(paid.body.data.amount)).toBe(100_000);
    expect(Number(paid.body.data.change_amount)).toBe(50_000);
    const replay = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send({ invoice_id: invoice.id, method: 'cash', amount: 100_000, cash_received: 150_000, idempotency_key: key });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
  });

  it('issues the final 354000 invoice from jasa, used part, and delivery snapshots', async () => {
    const [slot] = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('booking_slots').insert({ tenant_id: tenantId, branch_id: branchId, slot_date: '2026-11-22', capacity: 2 }).returning('id');
    });
    const [booking] = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('bookings').insert({ tenant_id: tenantId, branch_id: branchId, slot_id: slot.id, customer_id: customerId, device_id: deviceId, booking_code: `BK${uuidv4().replace(/-/g, '').slice(0, 10)}`, service_method: 'dropoff', complaint: 'Servis final', status: 'arrived', pickup_fee: 14_000 }).returning('id');
    });
    const ticketId = await insertTicket('selesai', { booking_id: booking.id, service_fee: 150_000, diagnostic_fee: 20_000 });
    const partId = await insertPart(1, 190_000);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('ticket_part_usages').insert({ tenant_id: tenantId, ticket_id: ticketId, part_id: partId, used_by: userId, qty: 1, unit_price: 190_000 });
    });

    const invoice = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({ ticket_id: ticketId });
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${token}`);
    expect(invoice.status).toBe(201);
    expect(Number(ticket.body.data.final_cost)).toBe(354_000);
    expect(Number(invoice.body.data.total)).toBe(354_000);
    expect(Number(invoice.body.data.subtotal)).toBe(340_000);
    expect(Number(invoice.body.data.pickup_fee)).toBe(14_000);
    expect(Number(invoice.body.data.additional_cost)).toBe(0);
    expect(invoice.body.data.line_items.map((line: any) => line.type)).toEqual(['service', 'part', 'delivery']);
    await expect(db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('invoices').where({ id: invoice.body.data.id }).update({ total: 1 });
    })).rejects.toThrow('Snapshot invoice yang sudah diterbitkan tidak dapat diubah');
  });

  it('perubahan status tiket disimpan ke current_status dan dicatat', async () => {
    const ticketId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [ticket] = await trx('service_tickets')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          customer_id: customerId,
          device_id: deviceId,
          received_by: userId,
          ticket_code: 'SRV' + uuidv4().replace(/-/g, '').slice(0, 12),
          tracking_token: uuidv4().replace(/-/g, '').slice(0, 32),
          service_method: 'dropoff',
          complaint: 'Status persistence test',
          current_status: 'antrian',
        })
        .returning('id');
      return ticket.id;
    });

    const response = await request(app)
      .put(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to_status: 'pengecekan' });

    expect(response.status).toBe(200);
    const check = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: ticketId }).select('current_status').first();
    });
    expect(check.current_status).toBe('pengecekan');

    const logs = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('ticket_status_logs').where({ ticket_id: ticketId }).select('from_status', 'to_status');
    });
    expect(logs).toContainEqual({ from_status: 'antrian', to_status: 'pengecekan' });
  });

  it('pemakaian sparepart mengurangi stok, mencatat histori, dan menolak stok kurang', async () => {
    const fixture = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [part] = await trx('parts').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        sku: 'LCD-' + uuidv4().slice(0, 8),
        name: 'LCD Samsung A55',
        unit: 'pcs',
        stock_qty: 1,
        min_stock: 0,
        cost_price: 500000,
        sell_price: 750000,
      }).returning('id');
      const ticketIds = [];
      const ticketCodes = [];
      for (let i = 0; i < 2; i++) {
        const ticketCode = 'SRV' + uuidv4().replace(/-/g, '').slice(0, 12);
        const [ticket] = await trx('service_tickets').insert({
          tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId,
          received_by: userId, technician_id: userId, ticket_code: ticketCode,
          tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff',
          complaint: 'LCD rusak', current_status: 'pengerjaan', work_type: 'with_parts',
          diagnosis_status: 'matches_complaint', requested_part_id: part.id, requested_part_qty: 1,
        }).returning('id');
        ticketIds.push(ticket.id);
        ticketCodes.push(ticketCode);
      }
      return { partId: part.id, ticketIds, ticketCodes };
    });

    const attempts = await Promise.all(fixture.ticketIds.map((ticketId) => request(app)
      .post('/api/parts-usage/use')
      .set('Authorization', `Bearer ${token}`)
      .send({ ticket_id: ticketId, part_id: fixture.partId, qty: 1, unit_price: 1 })));
    const usedIndex = attempts.findIndex((response) => response.status === 201);
    const used = attempts[usedIndex];
    const usedTicketId = fixture.ticketIds[usedIndex];
    const usedTicketCode = fixture.ticketCodes[usedIndex];
    const insufficient = attempts.find((response) => response.status === 409)!;

    expect(used.status).toBe(201);
    expect(insufficient.body.error).toBe('Stok Habis');
    expect(Number(used.body.data.usage.unit_price)).toBe(750000);
    expect(used.body.data.stock_qty).toBe(0);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('parts').where({ id: fixture.partId }).update({ sell_price: 900_000 });
    });

    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return {
        part: await trx('parts').where({ id: fixture.partId }).first(),
        usages: await trx('ticket_part_usages').where({ ticket_id: usedTicketId }).select('*'),
        movements: await trx('part_stock_movements').where({ ticket_id: usedTicketId }).select('*'),
      };
    });
    expect(saved.part.stock_qty).toBe(0);
    expect(saved.usages).toHaveLength(1);
    expect(saved.usages[0].qty).toBe(1);
    expect(saved.usages[0].used_by).toBe(userId);
    expect(saved.movements).toHaveLength(1);
    expect(saved.movements[0].movement_type).toBe('out');

    const ticketUsages = await request(app)
      .get(`/api/parts-usage/ticket/${usedTicketId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ticketUsages.status).toBe(200);
    expect(ticketUsages.body.data).toContainEqual(expect.objectContaining({
      part_name: 'LCD Samsung A55',
      qty: 1,
      net_qty: 1,
      unit_price: '750000.00',
      technician_name: 'Admin',
    }));

    const movements = await request(app)
      .get('/api/inventory/movements')
      .query({ search: usedTicketCode })
      .set('Authorization', `Bearer ${token}`);
    expect(movements.status).toBe(200);
    expect(movements.body.data).toContainEqual(expect.objectContaining({
      movement_type: 'out',
      qty: 1,
      ticket_code: usedTicketCode,
      user_name: 'Admin',
    }));

    const reversal = await request(app)
      .post(`/api/parts-usage/${used.body.data.movement.id}/reverse`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Salah quantity pemakaian' });
    expect(reversal.status).toBe(201);
    expect(reversal.body.data.movement_type).toBe('reversal');
    expect(reversal.body.data.reversal_reason).toBe('Salah quantity pemakaian');
    const reversedStock = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('parts').where({ id: fixture.partId }).select('stock_qty').first();
    });
    expect(reversedStock.stock_qty).toBe(1);

  });

  it('pengecekan tanpa sparepart langsung ke pengerjaan tanpa pergerakan stok', async () => {
    const ticketId = await insertTicket('pengecekan');
    const response = await request(app).post(`/api/tickets/${ticketId}/assessment`).set('Authorization', `Bearer ${token}`).send({
      work_type: 'without_parts', diagnosis_status: 'matches_complaint', technician_diagnosis: 'Kerusakan kabel fleksibel',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.current_status).toBe('pengerjaan');
    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return {
        ticket: await trx('service_tickets').where({ id: ticketId }).first(),
        movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
      };
    });
    expect(saved.ticket.work_type).toBe('without_parts');
    expect(saved.ticket.diagnosis_status).toBe('matches_complaint');
    expect(saved.movements).toHaveLength(0);
  });

  it('klien lama yang mengirim technician_note digabung ke Hasil Pemeriksaan Teknisi', async () => {
    const ticketId = await insertTicket('pengecekan');
    const response = await request(app).post(`/api/tickets/${ticketId}/assessment`).set('Authorization', `Bearer ${token}`).send({
      work_type: 'without_parts',
      diagnosis_status: 'matches_complaint',
      technician_diagnosis: 'IC charging rusak',
      technician_note: 'Korosi pada jalur power',
    });
    expect(response.status).toBe(200);
    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: ticketId }).select('technician_diagnosis').first();
    });
    expect(saved.technician_diagnosis).toBe('IC charging rusak\nKorosi pada jalur power');
  });

  it('stok kurang saat pengecekan mengirim seluruh tiket ke MENUNGGU_PART tanpa mengurangi stok', async () => {
    const partId = await insertPart(1);
    const ticketId = await insertTicket('pengecekan');
    const response = await request(app).post(`/api/tickets/${ticketId}/assessment`).set('Authorization', `Bearer ${token}`).send({
      work_type: 'with_parts', diagnosis_status: 'matches_complaint', technician_diagnosis: 'Panel perlu diganti', part_id: partId, part_qty: 2,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.current_status).toBe('menunggu_part');
    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return {
        part: await trx('parts').where({ id: partId }).first(),
        ticket: await trx('service_tickets').where({ id: ticketId }).first(),
        movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
      };
    });
    expect(Number(saved.part.stock_qty)).toBe(1);
    expect(saved.ticket.part_shortages).toEqual(expect.arrayContaining([expect.objectContaining({ shortage_qty: 1 })]));
    expect(saved.movements).toHaveLength(0);
  });

  it('quotation jasa-only menyimpan snapshot tanpa menyentuh inventory atau menyimpan token mentah', async () => {
    const ticketId = await insertTicket('pengecekan');
    const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${token}`).send({
      ticket_id: ticketId,
      work_type: 'without_parts',
      diagnosis_status: 'additional_damage',
      technician_diagnosis: 'IC charging rusak',
      technician_note: 'Perlu penggantian komponen',
      additional_damage: 'IC charging rusak',
      labor_estimate: 50_000,
      items: [{ damage_description: 'IC charging rusak', qty: 1, labor_cost: 50_000 }],
    });
    expect(response.status).toBe(201);
    expect(response.body.data.quotation.status).toBe('draft');
    expect(response.body.data.quotation.total_amount).toBe('50000.00');
    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const quote = await trx('quotations').where({ id: response.body.data.quotation.id }).first();
      return {
        quote,
        item: await trx('quotation_items').where({ quotation_id: quote.id }).first(),
        ticket: await trx('service_tickets').where({ id: ticketId }).first(),
        movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
      };
    });
    expect(saved.quote.approval_token).toBeNull();
    expect(saved.quote.approval_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.quote.technician_diagnosis_snapshot).toBe('IC charging rusak\nPerlu penggantian komponen');
    expect(saved.item.availability_status).toBeNull();
    expect(Number(saved.item.labor_cost)).toBe(50_000);
    expect(saved.ticket.current_status).toBe('menunggu_persetujuan');
    expect(saved.movements).toHaveLength(0);
  });

  it('diagnosa sesuai keluhan dengan part campuran membuat PENDING_APPROVAL lalu OPEN dan menunggu part sampai ditautkan', async () => {
    await withFakeWhatsApp(async () => {
      const registeredPartId = await insertPart(2, 100_000);
      const ticketId = await insertTicket('pengecekan');
      const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${token}`).send({
        ticket_id: ticketId,
        work_type: 'with_parts',
        diagnosis_status: 'matches_complaint',
        technician_diagnosis: 'IC charging perlu diganti; PMIC khusus masih belum tersedia.',
        labor_estimate: 0,
        items: [
          { damage_description: 'IC charging', part_id: registeredPartId, qty: 1, labor_cost: 0 },
          { damage_description: 'PMIC khusus', is_unregistered_part: true, requested_name: 'PMIC seri khusus', specification: 'Kode PM-77', qty: 1, labor_cost: 0, estimated_price: 150_000, estimated_part_arrival_days: 10 },
        ],
      });
      expect(response.status).toBe(201);
      expect(response.body.data.quotation.status).toBe('draft');
      expect(response.body.data.notification_status).toBe('queued');
      expect(response.body.data.approval_url).toBeNull();
      const quoteId = response.body.data.quotation.id;
      await waitForQuotationStatus(quoteId, 'sent');
      let tokenValue = lastApprovalUrl.split('/').pop()!;
      expect(tokenValue).toBeTruthy();
      const beforeApproval = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return {
          requests: await trx('part_requests').where({ quotation_id: quoteId }),
          movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
          part: await trx('parts').where({ id: registeredPartId }).first(),
          tokenHash: (await trx('quotations').where({ id: quoteId }).select('approval_token_hash').first()).approval_token_hash,
        };
      });
      expect(beforeApproval.requests).toHaveLength(1);
      expect(beforeApproval.requests[0].status).toBe('PENDING_APPROVAL');
      expect(Number(beforeApproval.part.stock_qty)).toBe(2);
      expect(beforeApproval.movements).toHaveLength(0);

      const retry = await request(app).post(`/api/quotations/${quoteId}/retry-send`).set('Authorization', `Bearer ${token}`);
      expect(retry.status).toBe(200);
      expect(retry.body.data.notification_status).toBe('queued');
      await waitForQuotationStatus(quoteId, 'sent');
      const rotatedHash = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return (await trx('quotations').where({ id: quoteId }).select('approval_token_hash').first()).approval_token_hash;
      });
      expect(rotatedHash).not.toBe(beforeApproval.tokenHash);
      tokenValue = lastApprovalUrl.split('/').pop()!;
      expect(hashQuotationToken(tokenValue)).toBe(rotatedHash);
      const prematureTransition = await request(app).put(`/api/tickets/${ticketId}/status`).set('Authorization', `Bearer ${token}`).send({ to_status: 'menunggu_part' });
      expect(prematureTransition.status).toBe(409);

      const decision = await request(app).post(`/api/public/quotations/${tokenValue}/decision`).send({ decision: 'approve' });
      expect(decision.status).toBe(200);
      expect(decision.body.data.ticket_status).toBe('menunggu_part');
      const [partRequest] = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('part_requests').where({ quotation_id: quoteId });
      });
      expect(partRequest.status).toBe('OPEN');

      const deniedOrder = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/order`).set('Authorization', `Bearer ${technicianToken}`).send({ estimated_arrival_days: 6 });
      expect(deniedOrder.status).toBe(403);
      const deniedReceive = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/receive`).set('Authorization', `Bearer ${technicianToken}`).send({ linked_part_id: registeredPartId, qty_received: 1 });
      expect(deniedReceive.status).toBe(403);
      const deniedCancel = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/cancel`).set('Authorization', `Bearer ${technicianToken}`).send({ reason: 'Tidak berwenang' });
      expect(deniedCancel.status).toBe(403);

      const ordered = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/order`).set('Authorization', `Bearer ${token}`).send({ estimated_arrival_days: 6 });
      expect(ordered.status).toBe(200);
      expect(ordered.body.data.status).toBe('ORDERED');
      const newPartSku = 'REQ-' + uuidv4().slice(0, 8);
      const createdPart = await request(app).post('/api/inventory/parts').set('Authorization', `Bearer ${token}`).send({
        part_request_id: partRequest.id,
        sku: newPartSku, name: 'Part baru dari request', spec: 'Rev A', category: 'Umum', unit: 'pcs',
        stock_qty: 7, min_stock: 0, cost_price: 160_000, sell_price: 0,
      });
      expect(createdPart.status).toBe(201);
      const createdPartId = createdPart.body.data.id;
      const beforeReceive = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return {
          part: await trx('parts').where({ id: createdPartId }).first(),
          movements: await trx('part_stock_movements').where({ part_id: createdPartId }).select('*'),
        };
      });
      expect(Number(beforeReceive.part.stock_qty)).toBe(0);
      expect(beforeReceive.movements).toHaveLength(0);

      const receivePayload = { linked_part_id: createdPartId, qty_received: 1, actual_price: 160_000 };
      const received = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/receive`).set('Authorization', `Bearer ${token}`).send(receivePayload);
      expect(received.status).toBe(201);
      expect(received.body.data.request.status).toBe('RECEIVED');
      expect(received.body.data.price_difference).toBe(10_000);
      expect(received.body.data.resumed_ticket_ids).toContain(ticketId);
      const receivedPartId = createdPartId;
      const replay = await request(app).post(`/api/inventory/part-requests/${partRequest.id}/receive`).set('Authorization', `Bearer ${token}`).send(receivePayload);
      expect(replay.status).toBe(409);
      const finalState = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return {
          ticket: await trx('service_tickets').where({ id: ticketId }).first(),
          part: await trx('parts').where({ id: receivedPartId }).first(),
          linkedItem: await trx('quotation_items').where({ quotation_id: quoteId, part_id: receivedPartId }).first(),
          movements: await trx('part_stock_movements').where({ part_id: receivedPartId }).select('*'),
        };
      });
      const history = await request(app).get('/api/inventory/movements').query({ search: newPartSku }).set('Authorization', `Bearer ${token}`);
      expect(finalState.ticket.current_status).toBe('pengerjaan');
      expect(Number(finalState.part.stock_qty)).toBe(1);
      expect(Number(finalState.part.sell_price)).toBe(0);
      expect(finalState.linkedItem.part_is_registered).toBe(false);
      expect(Number(finalState.linkedItem.part_unit_price_snapshot)).toBe(150_000);
      expect(finalState.movements).toHaveLength(1);
      expect(finalState.movements[0]).toEqual(expect.objectContaining({ movement_type: 'in', qty: 1 }));
      expect(history.status).toBe(200);
      expect(history.body.data).toContainEqual(expect.objectContaining({ movement_type: 'in', qty: 1, part_sku: newPartSku }));

      const regularPart = await request(app).post('/api/inventory/parts').set('Authorization', `Bearer ${token}`).send({
        sku: 'INV-' + uuidv4().slice(0, 8), name: 'Part stok awal inventaris', unit: 'pcs', stock_qty: 3, min_stock: 0,
        cost_price: 10_000, sell_price: 0,
      });
      expect(regularPart.status).toBe(201);
      expect(Number(regularPart.body.data.stock_qty)).toBe(3);
      expect(regularPart.body.movement).toEqual(expect.objectContaining({ movement_type: 'in', qty: 3 }));
    });
  });

  it('admin dapat menyetujui quotation DRAFT secara manual dan membuka request part custom', async () => {
    await withUnconfiguredWhatsApp(async () => {
      const ticketId = await insertTicket('pengecekan');
      const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${technicianToken}`).send({
        ticket_id: ticketId,
        work_type: 'with_parts',
        diagnosis_status: 'additional_damage',
        technician_diagnosis: 'Perlu penggantian modul custom.',
        additional_damage: 'Modul custom rusak',
        labor_estimate: 25_000,
        items: [{ damage_description: 'Modul custom rusak', is_unregistered_part: true, requested_name: 'Modul X-7', specification: 'Rev 7', qty: 1, labor_cost: 25_000, estimated_price: 125_000, estimated_part_arrival_days: 5 }],
      });
      expect(response.status).toBe(201);
      expect(response.body.data.quotation.status).toBe('draft');
      expect(response.body.data.approval_url).toBeNull();
      const quotationId = response.body.data.quotation.id;
      const notification = await waitForNotification(quotationId);
      expect(notification).toMatchObject({ status: 'failed', error_code: 'PROVIDER_NOT_CONFIGURED', error_message: 'provider tidak dikonfigurasi' });

      const adminDetail = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${token}`);
      expect(adminDetail.body.data.quotation.notification).toMatchObject({
        status: 'failed',
        error_message: 'provider tidak dikonfigurasi',
        approval_url: expect.stringContaining('/quotation/approve/'),
      });
      const previewToken = adminDetail.body.data.quotation.notification.approval_url.split('/').pop();
      const publicPreview = await request(app).get(`/api/public/quotations/${previewToken}`);
      expect(publicPreview.status).toBe(200);
      expect(publicPreview.body.data.status).toBe('draft');
      const blockedPublicDecision = await request(app).post(`/api/public/quotations/${previewToken}/decision`).send({ decision: 'approve' });
      expect(blockedPublicDecision.status).toBe(409);
      process.env.NODE_ENV = 'production';
      const productionDetail = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${token}`);
      expect(productionDetail.body.data.quotation.notification).not.toHaveProperty('approval_url');
      process.env.NODE_ENV = 'development';
      const technicianDetail = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${technicianToken}`);
      expect(technicianDetail.body.data.quotation).not.toHaveProperty('notification');
      const deniedManualDecision = await request(app).post(`/api/quotations/${quotationId}/manual-decision`).set('Authorization', `Bearer ${technicianToken}`).send({
        decision: 'approved', note: 'Teknisi tidak memiliki izin keputusan manual.',
      });
      expect(deniedManualDecision.status).toBe(403);

      const decision = await request(app).post(`/api/quotations/${quotationId}/manual-decision`).set('Authorization', `Bearer ${token}`).send({
        decision: 'approved', note: 'Pelanggan menyetujui melalui telepon; biaya sudah dikonfirmasi.',
      });
      expect(decision.status).toBe(200);
      expect(decision.body.data.approval_mode).toBe('MANUAL');
      expect(decision.body.data.ticket_status).toBe('menunggu_part');

      const partRequests = await request(app).get('/api/inventory/part-requests').set('Authorization', `Bearer ${token}`);
      expect(partRequests.status).toBe(200);
      expect(partRequests.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ quotation_id: quotationId, requested_name: 'Modul X-7', status: 'OPEN' })]));
      const audit = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('audit_logs').where({ tenant_id: tenantId, quotation_id: quotationId, action: 'quotation.approved.manual' }).first();
      });
      expect(audit.note).toBe('Pelanggan menyetujui melalui telepon; biaya sudah dikonfirmasi.');
      expect(audit.new_values.approval_mode).toBe('MANUAL');
    });
  });

  it('kerusakan tambahan dengan part custom memakai quotation dan pembatalan pelanggan membatalkan request', async () => {
    await withFakeWhatsApp(async () => {
      const ticketId = await insertTicket('pengecekan');
      const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${token}`).send({
        ticket_id: ticketId,
        work_type: 'with_parts',
        diagnosis_status: 'additional_damage',
        technician_diagnosis: 'Ada korosi luas; perlu PMIC khusus.',
        additional_damage: 'PMIC khusus',
        labor_estimate: 50_000,
        items: [{ damage_description: 'PMIC khusus', is_unregistered_part: true, requested_name: 'PMIC-X', specification: 'Board rev 4', qty: 1, labor_cost: 50_000, estimated_price: 250_000, estimated_part_arrival_days: 8 }],
      });
      expect(response.status).toBe(201);
      const quoteId = response.body.data.quotation.id;
      const notification = await waitForNotification(quoteId);
      expect(notification.status).toBe('sent');
      const tokenValue = lastApprovalUrl.split('/').pop();
      const [requestRow] = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('part_requests').where({ quotation_id: quoteId });
      });
      expect(requestRow.status).toBe('PENDING_APPROVAL');
      const decision = await request(app).post(`/api/public/quotations/${tokenValue}/decision`).send({ decision: 'reject' });
      expect(decision.status).toBe(200);
      const saved = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return {
          ticket: await trx('service_tickets').where({ id: ticketId }).first(),
          request: await trx('part_requests').where({ id: requestRow.id }).first(),
          movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
        };
      });
      expect(saved.ticket.current_status).toBe('menunggu_persetujuan');
      expect(saved.request.status).toBe('CANCELLED');
      expect(saved.movements).toHaveLength(0);
    });
  });

  it('approval mengecek ulang stok tanpa menguranginya, memvalidasi token sekali pakai, dan mempertahankan snapshot harga', async () => {
    const partId = await insertPart(2, 100_000);
    const ticketId = await insertTicket('menunggu_persetujuan', {
      work_type: 'with_parts', diagnosis_status: 'additional_damage', technician_diagnosis: 'IC rusak', additional_damage: 'IC rusak',
    });
    const approvalToken = createQuotationToken();
    const quoteId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [quote] = await trx('quotations').insert({
        tenant_id: tenantId, ticket_id: ticketId, created_by: userId, approval_token_hash: hashQuotationToken(approvalToken),
        status: 'sent', total_amount: 100_000, technician_diagnosis_snapshot: 'IC charging rusak; korosi', expires_at: new Date(Date.now() + 86_400_000),
      }).returning('id');
      await trx('quotation_items').insert({
        tenant_id: tenantId, quotation_id: quote.id, part_id: partId, item_type: 'part', description: 'IC rusak',
        damage_description: 'IC rusak', qty: 1, unit_price: 100_000, subtotal: 100_000, part_cost: 100_000,
        part_unit_price_snapshot: 100_000, availability_status: 'TERSEDIA', available_qty_snapshot: 2,
      });
      await trx('parts').where({ id: partId }).update({ sell_price: 200_000 });
      return quote.id as string;
    });

    const publicQuote = await request(app).get(`/api/public/quotations/${approvalToken}`);
    expect(publicQuote.status).toBe(200);
    expect(publicQuote.body.data.items[0].availability_status).toBe('TERSEDIA');
    expect(publicQuote.body.data.technician_diagnosis).toBe('IC charging rusak; korosi');
    const correction = await request(app).put(`/api/tickets/${ticketId}/inspection-result`).set('Authorization', `Bearer ${token}`).send({
      technician_diagnosis: 'IC charging rusak; korosi; perlu penggantian',
    });
    expect(correction.status).toBe(200);
    const unchangedQuote = await request(app).get(`/api/public/quotations/${approvalToken}`);
    expect(unchangedQuote.body.data.technician_diagnosis).toBe('IC charging rusak; korosi');
    const decision = await request(app).post(`/api/public/quotations/${approvalToken}/decision`).send({ decision: 'approve' });
    expect(decision.status).toBe(200);
    expect(decision.body.data.ticket_status).toBe('pengerjaan');
    const replay = await request(app).post(`/api/public/quotations/${approvalToken}/decision`).send({ decision: 'approve' });
    expect(replay.status).toBe(409);
    const saved = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return {
        part: await trx('parts').where({ id: partId }).first(),
        ticket: await trx('service_tickets').where({ id: ticketId }).first(),
        correctionAudit: await trx('audit_logs').where({ ticket_id: ticketId, action: 'ticket.inspection_result_updated_after_send' }).first(),
        quote: await trx('quotations').where({ id: quoteId }).first(),
        item: await trx('quotation_items').where({ quotation_id: quoteId }).first(),
        movements: await trx('part_stock_movements').where({ ticket_id: ticketId }),
      };
    });
    expect(Number(saved.part.stock_qty)).toBe(2);
    expect(saved.ticket.current_status).toBe('pengerjaan');
    expect(saved.quote.status).toBe('approved');
    expect(Number(saved.item.part_unit_price_snapshot)).toBe(100_000);
    expect(saved.correctionAudit.new_values.hasil_pemeriksaan_teknisi).toBe('IC charging rusak; korosi; perlu penggantian');
    expect(saved.movements).toHaveLength(0);

    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('service_tickets').where({ id: ticketId }).update({ diagnostic_fee: 25_000 });
      await trx('parts').where({ id: partId }).update({ cost_price: 1_000, sell_price: 200_000 });
    });
    const savedFee = await request(app).put(`/api/tickets/${ticketId}/service-fee`).set('Authorization', `Bearer ${token}`).send({ service_fee: 50_000 });
    expect(savedFee.status).toBe(200);
    expect(savedFee.body.data.finalCost).toBe(50_000);

    const usage = await request(app).post('/api/parts-usage/use').set('Authorization', `Bearer ${token}`).send({ ticket_id: ticketId, part_id: partId, qty: 1 });
    expect(usage.status).toBe(201);
    expect(Number(usage.body.data.usage.unit_price)).toBe(100_000);

    const costState = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: ticketId }).select('final_cost', 'diagnostic_fee').first();
    });
    expect(Number(costState.diagnostic_fee)).toBe(25_000);
    expect(Number(costState.final_cost)).toBe(150_000);

    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('service_tickets').where({ id: ticketId }).update({ current_status: 'selesai' });
    });

    const invoice = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({ ticket_id: ticketId });
    expect(invoice.status).toBe(201);
    expect(Number(invoice.body.data.subtotal)).toBe(150_000);
    expect(Number(invoice.body.data.total)).toBe(150_000);
  });

  it('approval expired atau token salah tidak dapat memutuskan quotation', async () => {
    const ticketId = await insertTicket('menunggu_persetujuan');
    const expiredToken = createQuotationToken();
    const quoteId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [quote] = await trx('quotations').insert({
        tenant_id: tenantId, ticket_id: ticketId, created_by: userId, approval_token_hash: hashQuotationToken(expiredToken),
        status: 'sent', total_amount: 1_000, expires_at: new Date(Date.now() - 1000),
      }).returning('id');
      const [item] = await trx('quotation_items').insert({
        tenant_id: tenantId, quotation_id: quote.id, item_type: 'part', description: 'Custom cable', damage_description: 'Custom cable',
        part_name_snapshot: 'Custom cable', part_specification_snapshot: 'Type C', part_is_registered: false,
        qty: 1, unit_price: 1_000, subtotal: 1_000, part_cost: 1_000, part_unit_price_snapshot: 1_000,
        availability_status: 'TIDAK_TERSEDIA', available_qty_snapshot: 0, estimated_part_arrival_days: 5,
      }).returning('id');
      await trx('part_requests').insert({
        tenant_id: tenantId, branch_id: branchId, ticket_id: ticketId, quotation_id: quote.id, quotation_item_id: item.id,
        requested_name: 'Custom cable', specification: 'Type C', qty: 1, estimated_price: 1_000, estimated_arrival_days: 5,
        status: 'PENDING_APPROVAL', requested_by: userId,
      });
      return quote.id as string;
    });
    const wrongToken = await request(app).post(`/api/public/quotations/${createQuotationToken()}/decision`).send({ decision: 'approve' });
    expect(wrongToken.status).toBe(404);
    const expiredDecision = await request(app).post(`/api/public/quotations/${expiredToken}/decision`).send({ decision: 'approve' });
    expect(expiredDecision.status).toBe(410);
    const expiredStatus = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return {
        quote: await trx('quotations').where({ id: quoteId }).first(),
        request: await trx('part_requests').where({ quotation_id: quoteId }).first(),
      };
    });
    expect(expiredStatus.quote.status).toBe('expired');
    expect(expiredStatus.request.status).toBe('CANCELLED');
  });

  it('biaya diagnosa baru ditagihkan setelah penolakan dibatalkan dan tetap tersimpan bila lanjut', async () => {
    const rejectedTicket = async () => {
      const ticketId = await insertTicket('menunggu_persetujuan');
      const quotationId = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        const [quotation] = await trx('quotations').insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          created_by: userId,
          approval_token_hash: hashQuotationToken(createQuotationToken()),
          status: 'rejected',
          total_amount: 1_000,
          expires_at: new Date(Date.now() + 86_400_000),
        }).returning('id');
        return quotation.id as string;
      });
      return { ticketId, quotationId };
    };

    const cancelled = await rejectedTicket();
    const diagnosticFee = await request(app).put(`/api/tickets/${cancelled.ticketId}/diagnostic-fee`)
      .set('Authorization', `Bearer ${token}`).send({ diagnostic_fee: 30_000 });
    expect(diagnosticFee.status).toBe(200);
    expect(diagnosticFee.body.data.finalCost).toBe(0);
    const cancellation = await request(app).post(`/api/quotations/${cancelled.quotationId}/resolve-rejection`)
      .set('Authorization', `Bearer ${token}`).send({ ticket_id: cancelled.ticketId, action: 'cancel_and_return' });
    expect(cancellation.status).toBe(200);
    const cancelledState = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: cancelled.ticketId }).first();
    });
    expect(cancelledState.current_status).toBe('batal');
    expect(Number(cancelledState.diagnostic_fee)).toBe(30_000);
    expect(Number(cancelledState.service_fee ?? 0)).toBe(0);
    expect(Number(cancelledState.final_cost)).toBe(30_000);
    const readyForReturn = await request(app).put(`/api/tickets/${cancelled.ticketId}/status`)
      .set('Authorization', `Bearer ${token}`).send({ to_status: 'siap_diambil' });
    expect(readyForReturn.status).toBe(200);
    const cancellationInvoice = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({ ticket_id: cancelled.ticketId });
    expect(cancellationInvoice.status).toBe(201);
    expect(Number(cancellationInvoice.body.data.subtotal)).toBe(0);
    expect(Number(cancellationInvoice.body.data.additional_cost)).toBe(30_000);
    expect(Number(cancellationInvoice.body.data.total)).toBe(30_000);

    const continued = await rejectedTicket();
    const retainedFee = await request(app).put(`/api/tickets/${continued.ticketId}/diagnostic-fee`)
      .set('Authorization', `Bearer ${token}`).send({ diagnostic_fee: 30_000 });
    expect(retainedFee.status).toBe(200);
    const continuation = await request(app).post(`/api/quotations/${continued.quotationId}/resolve-rejection`)
      .set('Authorization', `Bearer ${token}`).send({ ticket_id: continued.ticketId, action: 'continue_original' });
    expect(continuation.status).toBe(200);
    const labor = await request(app).put(`/api/tickets/${continued.ticketId}/service-fee`)
      .set('Authorization', `Bearer ${token}`).send({ service_fee: 50_000 });
    expect(labor.status).toBe(200);
    const continuedState = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: continued.ticketId }).first();
    });
    expect(continuedState.workflow_resolution).toBe('continue_original');
    expect(Number(continuedState.diagnostic_fee)).toBe(30_000);
    expect(Number(continuedState.service_fee)).toBe(50_000);
    expect(Number(continuedState.final_cost)).toBe(50_000);
  });

  it('quotation CANCELLED dan SUPERSEDED membatalkan semua permintaan part terkait', async () => {
    for (const finalStatus of ['cancel', 'supersede'] as const) {
      const ticketId = await insertTicket('menunggu_persetujuan');
      const quoteId = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        const [quote] = await trx('quotations').insert({
          tenant_id: tenantId, ticket_id: ticketId, created_by: userId,
          approval_token_hash: hashQuotationToken(createQuotationToken()), status: 'sent',
          total_amount: 1_000, expires_at: new Date(Date.now() + 86_400_000),
        }).returning('id');
        const [item] = await trx('quotation_items').insert({
          tenant_id: tenantId, quotation_id: quote.id, item_type: 'part', description: 'Custom panel', damage_description: 'Custom panel',
          part_name_snapshot: 'Custom panel', part_is_registered: false, qty: 1, unit_price: 1_000, subtotal: 1_000,
          part_cost: 1_000, part_unit_price_snapshot: 1_000, availability_status: 'TIDAK_TERSEDIA',
          available_qty_snapshot: 0, estimated_part_arrival_days: 4,
        }).returning('id');
        await trx('part_requests').insert({
          tenant_id: tenantId, branch_id: branchId, ticket_id: ticketId, quotation_id: quote.id, quotation_item_id: item.id,
          requested_name: 'Custom panel', qty: 1, estimated_price: 1_000, estimated_arrival_days: 4,
          status: 'PENDING_APPROVAL', requested_by: userId,
        });
        return quote.id as string;
      });
      const response = await request(app).post(`/api/quotations/${quoteId}/${finalStatus}`).set('Authorization', `Bearer ${token}`).send({ reason: 'Revisi permintaan pelanggan' });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(finalStatus === 'cancel' ? 'cancelled' : 'superseded');
      const partRequest = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('part_requests').where({ quotation_id: quoteId }).first();
      });
      expect(partRequest.status).toBe('CANCELLED');
    }
  });

  it('transisi status ilegal ditolak dan dicatat pada audit trail', async () => {
    const ticketId = await insertTicket('antrian');
    const response = await request(app).put(`/api/tickets/${ticketId}/status`).set('Authorization', `Bearer ${token}`).send({ to_status: 'quality_check' });
    expect(response.status).toBe(409);
    const audit = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('audit_logs').where({ tenant_id: tenantId, entity_id: ticketId, action: 'ticket.status_transition_rejected' }).first();
    });
    expect(audit).toBeTruthy();
  });

  it('tiket bisa ditutup jika invoice paid (200) dan log tercatat', async () => {
    const ticketId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [t] = await trx('service_tickets').insert({ tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId, received_by: userId, ticket_code: 'SRV-' + (Date.now() + 1).toString().slice(-12).padStart(12, '0'), tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff', complaint: 'rusak2', current_status: 'quality_check' }).returning('id');
      await trx('ticket_status_logs').insert({ tenant_id: tenantId, ticket_id: t.id, changed_by: userId, to_status: 'quality_check' });
      const [inv] = await trx('invoices').insert({ tenant_id: tenantId, ticket_id: t.id, invoice_no: 'INV-' + t.id.slice(0, 8), subtotal: 100000, total: 100000, status: 'paid' }).returning('id');
      await trx('payments').insert({ tenant_id: tenantId, invoice_id: inv.id, method: 'qris', amount: 100000, status: 'paid', paid_at: new Date() });
      return t.id;
    });
    const res = await request(app).post("/api/tickets/" + ticketId + "/close").set('Authorization', "Bearer " + token).send({ to_status: 'selesai' });
    expect(res.status).toBe(200);
    const check = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('service_tickets').where({ id: ticketId }).first();
    });
    expect(check.current_status).toBe('selesai');
    expect(check.completed_at).not.toBeNull();
    const logs = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('ticket_status_logs').where({ ticket_id: ticketId }).orderBy('created_at', 'desc').select('*');
    });
    expect(logs.some((l: any) => l.to_status === 'selesai')).toBe(true);
  });

  it('dashboard mengembalikan KPI dan filter tanggal', async () => {
    const res = await request(app).get('/api/reports/dashboard?from=2020-01-01&to=2030-01-01').set('Authorization', "Bearer " + token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('revenue');
    expect(res.body.data).toHaveProperty('unpaid');
    expect(res.body.data).toHaveProperty('active');
    expect(res.body.data).toHaveProperty('done');
  });

  it('export JSON dan CSV', async () => {
    const j = await request(app).get('/api/reports/export?from=2020-01-01&to=2030-01-01&format=json').set('Authorization', "Bearer " + token);
    expect(j.status).toBe(200);
    expect(j.body.data).toBeDefined();
    const c = await request(app).get('/api/reports/export?from=2020-01-01&to=2030-01-01&format=csv').set('Authorization', "Bearer " + token);
    expect(c.status).toBe(200);
    expect(c.headers['content-type']).toMatch(/text\/csv/);
  });

  it('tanpa token ditolak 401', async () => {
    const r = await request(app).get('/api/reports/dashboard');
    expect(r.status).toBe(401);
  });
});
