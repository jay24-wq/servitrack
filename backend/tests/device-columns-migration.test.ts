import { afterAll, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import knex from 'knex';
import { migratorConfig } from '../config/database.ts';
import * as backfill from '../src/models/migrations/20261120000200_backfill_device_model.js';
import * as backup from '../src/models/migrations/20261120000300_backup_device_columns.js';
import * as tracking from '../src/models/migrations/20261120000400_update_track_public_device_payload.js';
import * as dropSerial from '../src/models/migrations/20261120000500_drop_device_serial_number.js';
import * as dropBrand from '../src/models/migrations/20261120000600_drop_device_brand.js';

const migratorDb = knex(migratorConfig);

describe('device columns migration and rollback', () => {
  it('backs up every source row, preserves model names, drops both columns, and restores old values', async () => {
    if (!(process.env.DB_NAME || 'servitrack').endsWith('_test')) {
      throw new Error('Guard migration test: nama database harus berakhiran _test');
    }

    const trx = await migratorDb.transaction();
    const tenantId = uuid();
    try {
      if (!(await trx.schema.hasColumn('devices', 'brand'))) {
        await trx.schema.alterTable('devices', (table) => table.string('brand', 50));
      }
      if (!(await trx.schema.hasColumn('devices', 'serial_number'))) {
        await trx.schema.alterTable('devices', (table) => table.string('serial_number', 80));
      }

      await trx('tenants').insert({
        id: tenantId,
        name: 'Migration Test',
        slug: `migration-${tenantId.slice(0, 8)}`,
        owner_name: 'Migration Test',
        phone: '081234567890',
      });
      const [customer] = await trx('customers').insert({
        tenant_id: tenantId,
        name: 'Migration Test',
        phone_wa: `628${tenantId.replace(/\D/g, '').slice(0, 10)}`,
      }).returning('id');
      const devices = await trx('devices').insert([
        { tenant_id: tenantId, customer_id: customer.id, category: 'smartphone', brand: 'Samsung', model: null, serial_number: 'SN-OLD-1' },
        { tenant_id: tenantId, customer_id: customer.id, category: 'smartphone', brand: 'Samsung', model: 'Samsung', serial_number: 'SN-OLD-2' },
        { tenant_id: tenantId, customer_id: customer.id, category: 'laptop', brand: 'Asus', model: 'Asus ROG Strix 16 2025', serial_number: 'SN-OLD-3' },
        { tenant_id: tenantId, customer_id: customer.id, category: 'laptop', brand: '-', model: null, serial_number: null },
      ]).returning(['id', 'brand', 'model', 'serial_number']);

      await backfill.up(trx);
      await backup.up(trx);

      const models = await Promise.all(devices.map(async (device) => (
        await trx('devices').where({ id: device.id }).first('model')
      )?.model));
      expect(models).toEqual(['Samsung', 'Samsung', 'Asus ROG Strix 16 2025', null]);

      const sourceCount = await trx('devices').count('* as count').first();
      const backupCount = await trx('device_columns_backup_20261120').count('* as count').first();
      expect(Number(backupCount?.count)).toBe(Number(sourceCount?.count));
      for (const device of devices) {
        const saved = await trx('device_columns_backup_20261120').where({ device_id: device.id }).first();
        expect(saved.brand).toBe(device.brand);
        expect(saved.serial_number).toBe(device.serial_number);
      }

      await tracking.up(trx);
      await dropSerial.up(trx);
      await dropBrand.up(trx);
      expect(await trx.schema.hasColumn('devices', 'serial_number')).toBe(false);
      expect(await trx.schema.hasColumn('devices', 'brand')).toBe(false);
      expect(await trx.schema.hasColumn('devices', 'model')).toBe(true);

      await dropBrand.down(trx);
      await dropSerial.down(trx);
      await tracking.down(trx);
      const restored = await Promise.all(devices.map((device) => trx('devices').where({ id: device.id }).first()));
      expect(restored.map((device) => device.brand)).toEqual(['Samsung', 'Samsung', 'Asus', '-']);
      expect(restored.map((device) => device.serial_number)).toEqual(['SN-OLD-1', 'SN-OLD-2', 'SN-OLD-3', null]);
      expect(restored.map((device) => device.model)).toEqual(['Samsung', 'Samsung', 'Asus ROG Strix 16 2025', null]);
    } finally {
      await trx.rollback();
    }
  });
});

afterAll(async () => {
  if ((process.env.DB_NAME || 'servitrack').endsWith('_test')) await migratorDb.destroy();
});
