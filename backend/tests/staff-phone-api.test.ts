import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import db from '../src/models/index';

vi.mock('../src/services/auditLog', () => ({ logAudit: vi.fn() }));

import app from '../src/server';

describe('staff phone API', () => {
  const suffix = randomUUID();
  let tenantId: string | undefined;
  let adminToken: string;

  beforeAll(async () => {
    if (!(process.env.DB_TEST_NAME || process.env.DB_NAME || '').endsWith('_test')) {
      throw new Error('Guard: database name must end with _test');
    }

    const registered = await request(app).post('/api/auth/register').send({
      tenant_name: 'Workshop Staff Phone Test',
      slug: `staff-phone-${suffix.slice(0, 8)}`,
      owner_name: 'Owner Test',
      phone: '62812345678',
      email: `owner-${suffix}@test.com`,
      password: 'password123',
      address: 'Alamat workshop test',
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(registered.status).toBe(201);
    tenantId = registered.body.data.tenant_id;
    adminToken = registered.body.token;
  });

  afterAll(async () => {
    if (!tenantId) return;
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('audit_logs').where({ tenant_id: tenantId }).delete();
      await trx('booking_slots').where({ tenant_id: tenantId }).delete();
      await trx('users').where({ tenant_id: tenantId }).delete();
      await trx('branches').where({ tenant_id: tenantId }).delete();
      await trx('subscriptions').where({ tenant_id: tenantId }).delete();
      await trx('tenants').where({ id: tenantId }).delete();
    });
  });

  it('stores and returns phone without converting international format', async () => {
    const invalid = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Staff Phone Test', email: `staff-${suffix}@test.com`, phone: '081234567890', password: 'password123', role: 'frontdesk' });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Staff Phone Test', email: `staff-${suffix}@test.com`, phone: '6281234567890', password: 'password123', role: 'frontdesk' });
    expect(created.status).toBe(201);
    expect(created.body.data.phone).toBe('6281234567890');

    const invalidUpdate = await request(app)
      .put(`/api/staff/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '081298765432' });
    expect(invalidUpdate.status).toBe(400);

    const updated = await request(app)
      .put(`/api/staff/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '6289876543210' });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.data.phone).toBe('6289876543210');

    const listed = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.find((staff: { id: string }) => staff.id === created.body.data.id).phone).toBe('6289876543210');
  });
});
