import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import app from '../src/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Ticket Closure, Dashboard, Export', () => {
  let tenantId: string;
  let branchId: string;
  let userId: string;
  let customerId: string;
  let deviceId: string;
  let token: string;

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
      const [c] = await trx('customers').insert({ tenant_id: tenantId, name: 'Cust', phone_wa: '081' }).returning('id');
      customerId = c.id;
      const [d] = await trx('devices').insert({ tenant_id: tenantId, customer_id: customerId, category: 'hp', brand: 'X' }).returning('id');
      deviceId = d.id;
    });
    token = jwt.sign({ user_id: userId, tenant_id: tenantId, role: 'admin', email: 'admin@close.test' }, process.env.JWT_SECRET || 'servitrack-dev-jwt-secret-change-me', { expiresIn: '1h' });
  });

  afterAll(async () => {
    for (const tid of [tenantId].filter(Boolean)) {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tid]);
        await trx('ticket_status_logs').delete();
        await trx('payments').delete();
        await trx('invoices').delete();
        await trx('service_tickets').delete();
        await trx('devices').delete();
        await trx('customers').delete();
        await trx('users').delete();
        await trx('branches').delete();
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

  it('tiket bisa ditutup jika invoice paid (200) dan log tercatat', async () => {
    const ticketId = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [t] = await trx('service_tickets').insert({ tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId, received_by: userId, ticket_code: 'SRV-' + (Date.now() + 1).toString().slice(-12).padStart(12, '0'), tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff', complaint: 'rusak2', current_status: 'antrian' }).returning('id');
      await trx('ticket_status_logs').insert({ tenant_id: tenantId, ticket_id: t.id, changed_by: userId, to_status: 'antrian' });
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
