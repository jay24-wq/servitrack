import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import app from '../src/server';
import request from 'supertest';

describe('Auth, Users, Customers - RLS & PlanGuard', () => {
  let adminToken1: string;
  let adminToken2: string;
  let tenantIdTokoA: string;
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

  it('should register test tenants with a duplicate email across tenants', async () => {
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        tenant_name: 'Toko Uji 1',
        slug: 'toko-uji-1',
        owner_name: 'Owner 1',
        phone: '62812345678',
        email: 'owner1@test.com',
        password: 'password123',
        address: 'Alamat workshop untuk pengujian',
        latitude: -8.6705,
        longitude: 115.2126,
      });
    expect(res1.status).toBe(201);
    expect(res1.body.token).toBeDefined();
    expect(res1.body.user.role).toBe('admin');
    expect(res1.body.user.branch_id).toBeDefined();
    expect(Number(res1.body.data.latitude)).toBeCloseTo(-8.6705);
    expect(Number(res1.body.data.longitude)).toBeCloseTo(115.2126);
    tenantIdTokoA = res1.body.data.tenant_id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        tenant_name: 'Toko Uji 2',
        slug: 'toko-uji-2',
        owner_name: 'Owner 2',
        phone: '62812345679',
        email: 'owner2@test.com',
        password: 'password123',
        address: 'Jl. Raya Serpong, Tangerang Selatan',
        latitude: -6.3021,
        longitude: 106.6522,
      });
    expect(res2.status).toBe(201);

    const duplicateEmail = await request(app)
      .post('/api/auth/register')
      .send({
        tenant_name: 'Toko Uji 3',
        slug: 'toko-uji-3',
        owner_name: 'Owner 1 Duplikat',
        phone: '62812345680',
        email: 'owner1@test.com',
        password: 'different-password-123',
        address: 'Jl. Sunset Road, Badung, Bali',
        latitude: -8.6951,
        longitude: 115.1762,
      });
    expect(duplicateEmail.status).toBe(201);
  });

  it('should login owner1 without a tenant slug and get token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner1@test.com',
        password: 'password123',
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.tenant_id).toBe(tenantIdTokoA);
    adminToken1 = res.body.token;
  });

  it('should login owner2 without a tenant slug and get token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner2@test.com',
        password: 'password123',
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    adminToken2 = res.body.token;
  });

  it('should list only branches owned by the authenticated tenant', async () => {
    const res = await request(app)
      .get('/api/branches')
      .set('Authorization', `Bearer ${adminToken1}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data.every((branch: { tenant_id: string }) => branch.tenant_id === tenantIdTokoA)).toBe(true);
  });

  it('should reject an owner from the staff portal without a tenant slug', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner1@test.com', password: 'password123', portal: 'staff' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Silakan gunakan Portal Admin.');
  });

});
