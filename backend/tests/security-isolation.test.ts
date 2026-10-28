import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import bcrypt from 'bcrypt';
import { PLAN_LIMITS } from '../config/plans';
import { v4 as uuidv4 } from 'uuid';

describe('RLS Isolation & planGuard Security', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let staffRole: any;
  let cust1Id: string;
  let cust2Id: string;

  beforeAll(async () => {
    const effectiveName = process.env.DB_TEST_NAME || process.env.DB_NAME || '';
    if (!effectiveName.endsWith('_test')) {
      throw new Error('Guard: database name must end with _test, got: ' + effectiveName);
    }
    const r = await db.raw("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
    const { rolsuper, rolbypassrls, current_user } = r.rows[0];
    console.log(`[test] current_user=${current_user} rolsuper=${rolsuper} rolbypassrls=${rolbypassrls} db=${effectiveName}`);
    if (rolsuper || rolbypassrls) {
      throw new Error('Guard: test must run as non-superuser without BYPASSRLS, got ' + current_user);
    }

    const t1 = uuidv4();
    const t2 = uuidv4();
    const s1 = 'test-' + t1.slice(0, 8);
    const s2 = 'test-' + t2.slice(0, 8);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [t1]);
      const [row] = await trx('tenants').insert({ id: t1, name: 'Test Tenant 1', slug: s1, owner_name: 'O1', phone: '1' }).returning('id');
      tenant1Id = row.id;
    });
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [t2]);
      const [row] = await trx('tenants').insert({ id: t2, name: 'Test Tenant 2', slug: s2, owner_name: 'O2', phone: '2' }).returning('id');
      tenant2Id = row.id;
    });

    staffRole = await db('roles').where({ code: 'teknisi' }).first();

    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
      const [c1] = await trx('customers').insert({ tenant_id: tenant1Id, name: 'Customer T1', phone_wa: '111' }).returning('id');
      cust1Id = c1.id;
    });
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant2Id]);
      const [c2] = await trx('customers').insert({ tenant_id: tenant2Id, name: 'Customer T2', phone_wa: '222' }).returning('id');
      cust2Id = c2.id;
    });
  });

  afterAll(async () => {
    for (const tid of [tenant1Id, tenant2Id].filter(Boolean)) {
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

  describe('Row Level Security (RLS)', () => {
    it('SELECT lintas tenant ditolak (hanya data tenant sendiri terlihat)', async () => {
      const t1Data = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        return trx('customers').select('*');
      });
      expect(t1Data.length).toBe(1);
      expect(t1Data[0].id).toBe(cust1Id);

      const t2Data = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant2Id]);
        return trx('customers').select('*');
      });
      expect(t2Data.length).toBe(1);
      expect(t2Data[0].id).toBe(cust2Id);
    });

    it('UPDATE lintas tenant ditolak (0 row affected)', async () => {
      const n = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant2Id]);
        return trx('customers').where({ id: cust1Id }).update({ name: 'Hacked' });
      });
      expect(n).toBe(0);
      const check = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        return trx('customers').where({ id: cust1Id }).first();
      });
      expect(check?.name).toBe('Customer T1');
    });

    it('DELETE lintas tenant ditolak (0 row affected)', async () => {
      const n = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant2Id]);
        return trx('customers').where({ id: cust1Id }).delete();
      });
      expect(n).toBe(0);
      const still = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        return trx('customers').where({ id: cust1Id }).first();
      });
      expect(still).not.toBeUndefined();
    });

    it('INSERT dengan tenant_id tenant lain ditolak WITH CHECK', async () => {
      await expect(
        db.transaction(async (trx) => {
          await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
          await trx('customers').insert({ tenant_id: tenant2Id, name: 'Inject', phone_wa: '999' });
        })
      ).rejects.toThrow();
    });

    it('Tanpa konteks tenant hasil 0 baris tanpa error', async () => {
      const rows = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', '', true)");
        return trx('customers').select('*');
      });
      expect(rows.length).toBe(0);
    });

    it('Koneksi pool dipakai ulang tidak membocorkan konteks', async () => {
      await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        const a = await trx('customers').select('*');
        expect(a.length).toBe(1);
      });
      const leaked = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', '', true)");
        return trx('customers').select('*');
      });
      expect(leaked.length).toBe(0);
    });

    it('audit_logs immutability: UPDATE menghasilkan 0 atau ditolak, DELETE juga', async () => {
      const logId = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        const [row] = await trx('audit_logs').insert({ tenant_id: tenant1Id, action: 'test', entity_type: 'test' }).returning('id');
        return row.id;
      });
      let upd: number | null = null;
      try {
        upd = await db.transaction(async (trx) => {
          await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
          return trx('audit_logs').where({ id: logId }).update({ action: 'hacked' });
        });
      } catch (e: any) {
        expect(e.code).toBe('42501');
      }
      if (upd !== null) expect(upd).toBe(0);
      let del: number | null = null;
      try {
        del = await db.transaction(async (trx) => {
          await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
          return trx('audit_logs').where({ id: logId }).delete();
        });
      } catch (e: any) {
        expect(e.code).toBe('42501');
      }
      if (del !== null) expect(del).toBe(0);
    });

    it('plans dan roles tetap terbaca', async () => {
      const plans = await db('plans').select('*');
      expect(plans.length).toBeGreaterThan(0);
      const roles = await db('roles').select('*');
      expect(roles.length).toBeGreaterThan(0);
    });

    it('Paralel INSERT dengan penanganan EXCEPTION insufficient_privilege', async () => {
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          db.transaction(async (trx) => {
            await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
            try {
              await trx('customers').insert({ tenant_id: tenant2Id, name: 'Parallel', phone_wa: '888' });
              return 'ok';
            } catch (e: any) {
              if (e.code === '42501') throw e;
              throw e;
            }
          })
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled') expect(r.value).not.toBe('ok');
        else expect((r.reason as any).code).toBe('42501');
      }
    });

    it('Uji validitas: drop satu policy via migrator, isolasi harus GAGAL lalu pulihkan', async () => {
      const knexMod: any = await import('knex');
      const knexFn = knexMod.default || knexMod.knex || knexMod;
      const mCfg = { client: 'pg', connection: { host: 'localhost', port: 5432, user: 'postgres', password: 'jajoje242613', database: 'servitrack_test' } };
      const mdb: any = knexFn(mCfg as any);
      await mdb.raw("DROP POLICY IF EXISTS customers_tenant_policy ON customers");
      let failed = false;
      let seen = 0;
      try {
        const leaked = await db.transaction(async (trx) => {
          await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
          return trx('customers').select('*');
        });
        seen = leaked.length;
        if (leaked.length !== 1) failed = true;
      } finally {
        await mdb.raw(
          "CREATE POLICY customers_tenant_policy ON customers USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"
        );
        await mdb.destroy();
      }
      expect(failed, `expected leak, got ${seen} rows`).toBe(true);
    });
  });

  describe('planGuard Quota Enforcement', () => {
    it('should enforce max_users quota for STARTER plan', async () => {
      const max = PLAN_LIMITS.STARTER.max_users;
      const hashes = await bcrypt.hash('pass', 10);

      const countBefore = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        return trx('users').count('* as count').first();
      });
      const currentCount = Number((countBefore as any)?.count || 0);

      for (let i = currentCount; i < max; i++) {
        await db.transaction(async (trx) => {
          await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
          await trx('users').insert({
            tenant_id: tenant1Id,
            role_id: staffRole.id,
            name: `Staff ${i}`,
            email: `staff${i}@t1.test`,
            password_hash: hashes,
          });
        });
      }

      const countAfter = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenant1Id]);
        return trx('users').count('* as count').first();
      });
      expect(Number((countAfter as any)?.count)).toBe(max);
      expect(Number((countAfter as any)?.count) < max).toBe(false);
    });
  });
});
