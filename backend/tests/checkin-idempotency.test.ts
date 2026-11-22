import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../src/models/index';
import app from '../src/server';
import { appConfig } from '../config/app';
import { setNotificationProviderForTests } from '../src/services/notifications/notificationService';

describe('check-in idempotency and notification delivery', () => {
  let tenantId: string;
  let branchId: string;
  let token: string;
  let phoneSequence = 0;
  const uniquePhone = () => `+6281234${String(++phoneSequence).padStart(6, '0')}`;

  const createCheckin = (key = uuid(), model = `ROG Test ${uuid()}`, phone = '+6281234567890') => request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({
      service_method: 'dropoff',
      customer_name: 'Pelanggan Check-in',
      customer_phone: phone,
      device_category: 'laptop',
      device_model: model,
      device_pin: '1234',
      complaint: 'Perangkat mati mendadak setelah digunakan beberapa saat.',
    });

  const withTenant = <T>(callback: (trx: any) => Promise<T>) => db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
    return callback(trx);
  });

  const waitForNotifications = async (expected: 'sent' | 'failed', count: number) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const found = await withTenant((trx) => trx('notification_logs')
        .where({ tenant_id: tenantId, status: expected }).count('* as count').first());
      if (Number(found?.count ?? 0) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Notifikasi belum mencapai status ${expected} sebanyak ${count}`);
  };

  beforeAll(async () => {
    const databaseName = process.env.DB_NAME || 'servitrack';
    if (!databaseName.endsWith('_test')) throw new Error('Guard DB check-in: nama database harus berakhiran _test');
    const roleCheck = await db.raw('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    if (roleCheck.rows[0]?.rolsuper || roleCheck.rows[0]?.rolbypassrls) throw new Error('Guard DB check-in: gunakan role aplikasi non-superuser');

    tenantId = uuid();
    const passwordHash = await bcrypt.hash('checkin-test-password', 4);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('tenants').insert({ id: tenantId, name: 'Check-in Test', slug: `checkin-${tenantId.slice(0, 8)}`, owner_name: 'Test Owner', phone: '081234567890' });
      const [branch] = await trx('branches').insert({ tenant_id: tenantId, name: 'Cabang Test', is_main: true }).returning('id');
      branchId = branch.id;
      const role = await trx('roles').where({ code: 'admin' }).first();
      const [user] = await trx('users').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        role_id: role.id,
        name: 'Frontdesk Test',
        email: `checkin-${tenantId}@test.invalid`,
        password_hash: passwordHash,
      }).returning('id');
      await trx('tenant_notification_settings').insert({
        tenant_id: tenantId,
        channels: { whatsapp: false, email: false, in_app: false },
      });
      token = jwt.sign({
        user_id: user.id,
        tenant_id: tenantId,
        branch_id: branchId,
        role: 'admin',
        email: `checkin-${tenantId}@test.invalid`,
      }, appConfig.jwtSecret, { expiresIn: '1h' });
    });
  });

  afterEach(() => setNotificationProviderForTests(null));

  afterAll(async () => {
    if (tenantId) {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        await trx('notification_logs').where({ tenant_id: tenantId }).delete();
        await trx('booking_status_logs').where({ tenant_id: tenantId }).delete();
        await trx('ticket_status_logs').where({ tenant_id: tenantId }).delete();
        await trx('audit_logs').where({ tenant_id: tenantId }).delete();
        await trx('service_tickets').where({ tenant_id: tenantId }).delete();
        await trx('bookings').where({ tenant_id: tenantId }).delete();
        await trx('booking_slots').where({ tenant_id: tenantId }).delete();
        await trx('devices').where({ tenant_id: tenantId }).delete();
        await trx('customers').where({ tenant_id: tenantId }).delete();
        await trx('users').where({ tenant_id: tenantId }).delete();
        await trx('tenant_notification_settings').where({ tenant_id: tenantId }).delete();
        await trx('branches').where({ tenant_id: tenantId }).delete();
        await trx('tenants').where({ id: tenantId }).delete();
      }).catch(() => {});
    }
    await db.destroy();
  });

  it('dua POST paralel dengan Idempotency-Key sama hanya membuat satu tiket', async () => {
    const key = uuid();
    const responses = await Promise.all([createCheckin(key), createCheckin(key)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(responses[0].body.data.id).toBe(responses[1].body.data.id);

    const tickets = await withTenant((trx) => trx('service_tickets').where({ tenant_id: tenantId, idempotency_key: key }));
    expect(tickets).toHaveLength(1);
  });

  it('menyimpan nama perangkat check-in persis dari input', async () => {
    const model = 'Asus ROG Strix 16 2025';
    const response = await createCheckin(uuid(), model, uniquePhone());
    expect(response.status).toBe(201);
    const device = await withTenant((trx) => trx('devices').where({ id: response.body.data.device_id, tenant_id: tenantId }).first());
    expect(device.model).toBe(model);
  });

  it('menolak model kosong dan mendeteksi pengiriman walk-in ganda tanpa serial', async () => {
    const phone = uniquePhone();
    expect((await createCheckin(uuid(), '', phone)).status).toBe(400);

    const model = 'Samsung Galaxy A55 5G';
    expect((await createCheckin(uuid(), model, phone)).status).toBe(201);
    const duplicate = await createCheckin(uuid(), model, phone);
    expect(duplicate.status).toBe(409);
  });

  it('booking wajib memiliki model dan menyimpan input lengkap tanpa pemisahan merek', async () => {
    const slug = `checkin-${tenantId.slice(0, 8)}`;
    const missingModel = await request(app).post('/api/public/bookings').send({
      slug,
      name: 'Pelanggan Booking Tanpa Model',
      phone_wa: '+6281234500000',
      service_method: 'mandiri',
    });
    expect(missingModel.status).toBe(400);

    const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
    while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
    const model = 'Asus ROG Strix 16 2025';
    const created = await request(app).post('/api/public/bookings').send({
      slug,
      name: 'Pelanggan Booking Model',
      phone_wa: uniquePhone(),
      category: 'laptop',
      model,
      service_method: 'mandiri',
      slot_date: date.toISOString().slice(0, 10),
    });
    expect(created.status).toBe(201);

    const device = await withTenant(async (trx) => {
      const booking = await trx('bookings').where({ tenant_id: tenantId, booking_code: created.body.data.booking_code }).first();
      return trx('devices').where({ id: booking.device_id, tenant_id: tenantId }).first();
    });
    expect(device.model).toBe(model);
  });

  it('response check-in tidak menunggu provider WhatsApp yang lambat', async () => {
    await withTenant((trx) => trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({
      channels: { whatsapp: true, email: false, in_app: false },
    }));

    let releaseSend!: (result: { providerMessageId: string }) => void;
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: () => {
        started();
        return new Promise((resolve) => { releaseSend = resolve; });
      },
      healthCheck: async () => true,
    });

    const response = await createCheckin();
    expect(response.status).toBe(201);
    await providerStarted;
    releaseSend({ providerMessageId: 'slow-provider-test' });
    await waitForNotifications('sent', 1);
  });

  it('menyelesaikan 20 check-in beruntun tanpa menghabiskan pool', async () => {
    await withTenant((trx) => trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({
      channels: { whatsapp: false, email: false, in_app: false },
    }));

    const initialCount = await withTenant((trx) => trx('notification_logs').where({ tenant_id: tenantId }).count('* as count').first());
    const initialFailedCount = await withTenant((trx) => trx('notification_logs').where({ tenant_id: tenantId, status: 'failed' }).count('* as count').first());
    const initialTicketCount = await withTenant((trx) => trx('service_tickets').where({ tenant_id: tenantId }).count('* as count').first());
    const expected = Number(initialCount?.count ?? 0) + 20;
    const expectedFailed = Number(initialFailedCount?.count ?? 0) + 20;
    const expectedTickets = Number(initialTicketCount?.count ?? 0) + 20;
    for (let index = 0; index < 20; index += 1) {
      const response = await createCheckin(undefined, `ROG Pool ${uuid()}`);
      expect(response.status).toBe(201);
    }

    await waitForNotifications('failed', expectedFailed);
    const finalCheck = await withTenant(async (trx) => ({
      logs: await trx('notification_logs').where({ tenant_id: tenantId }).count('* as count').first(),
      tickets: await trx('service_tickets').where({ tenant_id: tenantId }).count('* as count').first(),
    }));
    expect(Number(finalCheck.logs?.count ?? 0)).toBeGreaterThanOrEqual(expected);
    expect(Number(finalCheck.tickets?.count ?? 0)).toBe(expectedTickets);
  });
});
