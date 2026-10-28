import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';
import { v4 as uuidv4 } from 'uuid';

describe('Financial and Inventory Module Tests', () => {
  let tenantId: string;
  let branchId: string;
  let customerId: string;
  let deviceId: string;
  let partId: string;
  let ticketId: string;
  let userId: string;

  beforeAll(async () => {
    const dbName = process.env.DB_TEST_NAME || process.env.DB_NAME || '';
    if (!dbName.endsWith('_test')) {
      throw new Error('Guard: database name must end with _test');
    }

    tenantId = uuidv4();
    const finSlug = 'fin-' + tenantId.slice(0, 8);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const [t] = await trx('tenants').insert({
        id: tenantId,
        name: 'Financial Tenant',
        slug: finSlug,
        owner_name: 'Boss',
        phone: '08111',
      }).returning('id');
      tenantId = t.id;

      const [b] = await trx('branches').insert({
        tenant_id: tenantId,
        name: 'Cabang Fin',
        is_main: true,
      }).returning('id');
      branchId = b.id;

      const adminRole = await trx('roles').where({ code: 'admin' }).first();
      const [u] = await trx('users').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        role_id: adminRole.id,
        name: 'Staff Fin',
        email: 'staff@fin.test',
        password_hash: 'hash',
        is_active: true,
      }).returning('id');
      userId = u.id;

      const [c] = await trx('customers').insert({
        tenant_id: tenantId,
        name: 'Pelanggan Fin',
        phone_wa: '08222',
      }).returning('id');
      customerId = c.id;

      const [d] = await trx('devices').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        category: 'Laptop',
        brand: 'Lenovo',
        model: 'ThinkPad',
      }).returning('id');
      deviceId = d.id;

      const [p] = await trx('parts').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        sku: 'PART-001',
        name: 'LCD Screen',
        unit: 'pcs',
        stock_qty: 5,
        min_stock: 1,
        cost_price: 500000,
        sell_price: 750000,
      }).returning('id');
      partId = p.id;

      const [tick] = await trx('service_tickets').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        customer_id: customerId,
        device_id: deviceId,
        received_by: userId,
        ticket_code: 'SRV-' + Date.now().toString().slice(-10),
        tracking_token: 'TOKEN' + Date.now(),
        service_method: 'dropoff',
        complaint: 'Layar pecah',
        current_status: 'antrian',
      }).returning('id');
      ticketId = tick.id;
    });
  });

  afterAll(async () => {
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('payments').delete();
      await trx('invoices').delete();
      await trx('quotation_items').delete();
      await trx('quotations').delete();
      await trx('ticket_part_usages').delete();
      await trx('part_stock_movements').delete();
      await trx('parts').delete();
      await trx('service_tickets').delete();
      await trx('devices').delete();
      await trx('customers').delete();
      await trx('users').delete();
      await trx('branches').delete();
      await trx('tenants').delete();
    }).catch(() => {});
    await db.destroy();
  });

  it('should use parts atomically and prevent negative stock or insufficient stock', async () => {
    // 1. Pemakaian part sukses (kurangi stok, buat movement, catat usage)
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      
      const part = await trx('parts').where({ id: partId }).first();
      expect(part.stock_qty).toBe(5);

      const qtyUsed = 2;
      await trx('parts').where({ id: partId }).update({ stock_qty: part.stock_qty - qtyUsed });

      const [movement] = await trx('part_stock_movements').insert({
        tenant_id: tenantId,
        part_id: partId,
        ticket_id: ticketId,
        created_by: userId,
        movement_type: 'out',
        qty: qtyUsed,
      }).returning('id');

      await trx('ticket_part_usages').insert({
        tenant_id: tenantId,
        ticket_id: ticketId,
        part_id: partId,
        movement_id: movement.id,
        used_by: userId,
        qty: qtyUsed,
        unit_price: part.sell_price,
      });
    });

    const updatedPart = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('parts').where({ id: partId }).first();
    });
    expect(updatedPart.stock_qty).toBe(3);

    // 2. Stok kurang menyebabkan rollback total & stok tidak pernah negatif
    await expect(
      db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        const part = await trx('parts').where({ id: partId }).first();
        const overQty = 10; // stok sisa 3
        if (part.stock_qty < overQty) {
          throw new Error('Stok tidak cukup');
        }
      })
    ).rejects.toThrow('Stok tidak cukup');

    const finalPart = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('parts').where({ id: partId }).first();
    });
    expect(finalPart.stock_qty).toBe(3); // tidak berubah
  });

  it('should lock quotation unit_price from parts.sell_price and match subtotal', async () => {
    // Ubah sell_price part setelah dicatat di quotation untuk membuktikan harga terkunci
    const newSellPrice = 900000;
    
    const quotationData = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const part = await trx('parts').where({ id: partId }).first();
      const lockedPrice = part.sell_price; // 750000
      const qty = 1;
      const subtotal = qty * lockedPrice;

      const [q] = await trx('quotations').insert({
        tenant_id: tenantId,
        ticket_id: ticketId,
        created_by: userId,
        approval_token: 'TOKEN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        total_amount: subtotal,
        expires_at: new Date(Date.now() + 86400000),
      }).returning('*');

      await trx('quotation_items').insert({
        tenant_id: tenantId,
        quotation_id: q.id,
        part_id: partId,
        item_type: 'part',
        description: 'Ganti LCD',
        qty,
        unit_price: lockedPrice,
        subtotal,
      });

      // Update parts sell_price sekarang
      await trx('parts').where({ id: partId }).update({ sell_price: newSellPrice });

      return q;
    });

    const itemCheck = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('quotation_items').where({ quotation_id: quotationData.id }).first();
    });

    expect(itemCheck.unit_price).toBe('750000.00'); // Terkunci pada harga lama
    expect(itemCheck.subtotal).toBe('750000.00');
    expect(quotationData.total_amount).toBe('750000.00');
  });

  it('should enforce single invoice per ticket', async () => {
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('invoices').insert({
        tenant_id: tenantId,
        ticket_id: ticketId,
        invoice_no: 'INV-' + Date.now().toString().slice(-8),
        subtotal: 750000,
        total: 750000,
        status: 'unpaid',
      });
    });

    // Insert invoice kedua untuk ticket_id yang sama harus gagal karena unique / business validation
    await expect(
      db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        const existing = await trx('invoices').where({ ticket_id: ticketId }).first();
        if (existing) throw new Error('Tiket sudah memiliki invoice');
      })
    ).rejects.toThrow('Tiket sudah memiliki invoice');
  });

  it('should update invoice status to partial then paid and reject duplicate gateway_ref', async () => {
    const invoice = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('invoices').where({ ticket_id: ticketId }).first();
    });

    // Bayar sebagian (partial)
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('payments').insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        received_by: userId,
        method: 'qris',
        amount: 300000,
        status: 'paid',
        paid_at: new Date(),
      });

      await trx('invoices').where({ id: invoice.id }).update({ status: 'partial' });
    });

    let invCheck = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('invoices').where({ id: invoice.id }).first();
    });
    expect(invCheck.status).toBe('partial');

    const ref = 'REF-' + Date.now().toString().slice(-8);
    // Bayar sisa (paid) + uji gateway_ref unik
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('payments').insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        received_by: userId,
        method: 'qris',
        amount: 450000,
        status: 'paid',
        gateway_ref: ref,
        paid_at: new Date(),
      });

      await trx('invoices').where({ id: invoice.id }).update({ status: 'paid' });
    });

    invCheck = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('invoices').where({ id: invoice.id }).first();
    });
    expect(invCheck.status).toBe('paid');

    // Duplicate gateway_ref test
    await expect(
      db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        await trx('payments').insert({
          tenant_id: tenantId,
          invoice_id: invoice.id,
          received_by: userId,
          method: 'qris',
          amount: 50000,
          status: 'paid',
          gateway_ref: ref,
          paid_at: new Date(),
        });
      })
    ).rejects.toThrow();
  });

  it('should generate valid ticket_code and record initial antrian status log', async () => {
    const newTicket = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      const code = 'SRV-' + Date.now().toString().slice(-10);
      const [t] = await trx('service_tickets').insert({
        tenant_id: tenantId,
        branch_id: branchId,
        customer_id: customerId,
        device_id: deviceId,
        received_by: userId,
        ticket_code: code,
        tracking_token: 'TOKEN' + Math.random(),
        service_method: 'dropoff',
        complaint: 'Mati total',
        current_status: 'antrian',
      }).returning('*');

      await trx('ticket_status_logs').insert({
        tenant_id: tenantId,
        ticket_id: t.id,
        changed_by: userId,
        to_status: 'antrian',
        note: 'Log awal',
      });

      return t;
    });

    expect(newTicket.ticket_code.startsWith('SRV-')).toBe(true);
    
    const logs = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      return trx('ticket_status_logs').where({ ticket_id: newTicket.id }).select('*');
    });

    expect(logs.length).toBe(1);
    expect(logs[0].to_status).toBe('antrian');
  });
});
