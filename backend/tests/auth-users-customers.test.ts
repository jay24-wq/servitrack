import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import app from '../src/server';
import request from 'supertest';

describe('Auth, Users, Customers - RLS & PlanGuard', () => {
  let adminToken1: string;
  let adminToken2: string;
  let userIdTokoA: string;
  let customerIdTokoA: string;

  beforeAll(async () => {
    if (!(process.env.DB_TEST_NAME || process.env.DB_NAME || '').endsWith('_test')) {
      throw new Error('Guard: database name must end with _test');
    }
    const ids: string[] = (await db.raw("SELECT id FROM tenants WHERE slug LIKE 'toko-uji%' OR slug LIKE 'test-%'").then((r: any) => r.rows.map((x: any) => x.id))) as any;
    for (const tid of ids) {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tid]);
        await trx('ticket_part_usages').delete();
        await trx('part_stock_movements').delete();
        await trx('ticket_status_logs').delete();
        await trx('ticket_photos').delete();
        await trx('ticket_notes').delete();
        await trx('payments').delete();
        await trx('invoices').delete();
        await trx('quotation_items').delete();
        await trx('quotations').delete();
        await trx('parts').delete();
        await trx('service_tickets').delete();
        await trx('bookings').delete();
        await trx('booking_slots').delete();
        await trx('devices').delete();
        await trx('customers').delete();
        await trx('chat_messages').delete();
        await trx('notification_logs').delete();
        await trx('audit_logs').delete();
        await trx('pickup_dropoff_requests').delete();
        await trx('courier_tasks').delete();
        await trx('users').delete();
        await trx('branches').delete();
        await trx('subscriptions').delete();
        await trx('tenants').delete();
      }).catch(() => {});
    }
  });

  afterAll(async () => {
    const ids: string[] = (await db.raw("SELECT id FROM tenants WHERE slug LIKE 'toko-uji%' OR slug LIKE 'test-%'").then((r: any) => r.rows.map((x: any) => x.id))) as any;
    for (const tid of ids) {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tid]);
        await trx('ticket_part_usages').delete();
        await trx('part_stock_movements').delete();
        await trx('ticket_status_logs').delete();
        await trx('ticket_photos').delete();
        await trx('ticket_notes').delete();
        await trx('payments').delete();
        await trx('invoices').delete();
        await trx('quotation_items').delete();
        await trx('quotations').delete();
        await trx('parts').delete();
        await trx('service_tickets').delete();
        await trx('bookings').delete();
        await trx('booking_slots').delete();
        await trx('devices').delete();
        await trx('customers').delete();
        await trx('chat_messages').delete();
        await trx('notification_logs').delete();
        await trx('audit_logs').delete();
        await trx('pickup_dropoff_requests').delete();
        await trx('courier_tasks').delete();
        await trx('users').delete();
        await trx('branches').delete();
        await trx('subscriptions').delete();
        await trx('tenants').delete();
      }).catch(() => {});
    }
    await db.destroy();
  });

  it('should register toko-uji-1 and toko-uji-2', async () => {
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        tenant_name: 'Toko Uji 1',
        slug: 'toko-uji-1',
        owner_name: 'Owner 1',
        phone: '62812345678',
        email: 'owner1@test.com',
        password: 'password123',
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        tenant_name: 'Toko Uji 2',
        slug: 'toko-uji-2',
        owner_name: 'Owner 2',
        phone: '62812345679',
        email: 'owner2@test.com',
        password: 'password123',
      });
    expect(res2.status).toBe(201);
  });

  it('should login owner1 and get token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner1@test.com',
        password: 'password123',
        slug: 'toko-uji-1',
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    adminToken1 = res.body.token;
  });

  it('should login owner2 and get token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner2@test.com',
        password: 'password123',
        slug: 'toko-uji-2',
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    adminToken2 = res.body.token;
  });
});
