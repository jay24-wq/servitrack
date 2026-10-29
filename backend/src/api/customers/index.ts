import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';

export const customerRouter = Router();

customerRouter.use(authMiddleware);
customerRouter.use(tenantResolver);

// GET /api/customers - List customers with device count
customerRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const customers = await reqDb(req)('customers')
      .where({ tenant_id })
      .select('*')
      .orderBy('name', 'asc');

    res.json({ data: customers });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data pelanggan' });
  }
});

// GET /api/customers/:id - Detail customer + list devices
customerRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    const customer = await reqDb(req)('customers')
      .where({ id, tenant_id })
      .first();

    if (!customer) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      return;
    }

    const devices = await reqDb(req)('devices')
      .where({ customer_id: id, tenant_id })
      .select('*');

    res.json({ data: { ...customer, devices } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil detail pelanggan' });
  }
});

// POST /api/customers - Add customer
customerRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { name, phone, email, address } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
      return;
    }

    const [newCustomer] = await reqDb(req)('customers')
      .insert({
        tenant_id,
        name,
        phone,
        email: email || null,
        address: address || null,
      })
      .returning('*');

    res.status(201).json({ message: 'Pelanggan berhasil ditambahkan', data: newCustomer });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambahkan pelanggan' });
  }
});

// PUT /api/customers/:id - Update customer
customerRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { name, phone, email, address } = req.body;

    const [updated] = await reqDb(req)('customers')
      .where({ id, tenant_id })
      .update({
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
      })
      .returning('*');

    if (!updated) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      return;
    }

    res.json({ message: 'Pelanggan berhasil diperbarui', data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui pelanggan' });
  }
});

// DELETE /api/customers/:id - Delete customer
customerRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    const deleted = await reqDb(req)('customers')
      .where({ id, tenant_id })
      .delete();

    if (!deleted) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      return;
    }

    res.json({ message: 'Pelanggan berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus pelanggan' });
  }
});

// --- DEVICES SUB-ROUTES ---

// GET /api/customers/:customerId/devices - List customer devices
customerRouter.get('/:customerId/devices', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { customerId } = req.params;

    const devices = await reqDb(req)('devices')
      .where({ customer_id: customerId, tenant_id })
      .select('*');

    res.json({ data: devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data perangkat' });
  }
});

// POST /api/customers/:customerId/devices - Add device to customer
customerRouter.post('/:customerId/devices', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { customerId } = req.params;
    const { type, brand, model, serial_number, notes } = req.body;

    if (!type || !brand || !model) {
      res.status(400).json({ error: 'Tipe, merek (brand), dan model perangkat wajib diisi' });
      return;
    }

    const customer = await reqDb(req)('customers').where({ id: customerId, tenant_id }).first();
    if (!customer) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      return;
    }

    const [newDevice] = await reqDb(req)('devices')
      .insert({
        tenant_id,
        customer_id: customerId,
        type,
        brand,
        model,
        serial_number: serial_number || null,
        notes: notes || null,
      })
      .returning('*');

    res.status(201).json({ message: 'Perangkat berhasil ditambahkan', data: newDevice });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambahkan perangkat' });
  }
});

// PUT /api/customers/:customerId/devices/:deviceId - Update device
customerRouter.put('/:customerId/devices/:deviceId', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { customerId, deviceId } = req.params;
    const { type, brand, model, serial_number, notes } = req.body;

    const [updated] = await reqDb(req)('devices')
      .where({ id: deviceId, customer_id: customerId, tenant_id })
      .update({
        ...(type && { type }),
        ...(brand && { brand }),
        ...(model && { model }),
        ...(serial_number !== undefined && { serial_number }),
        ...(notes !== undefined && { notes }),
      })
      .returning('*');

    if (!updated) {
      res.status(404).json({ error: 'Perangkat tidak ditemukan' });
      return;
    }

    res.json({ message: 'Perangkat berhasil diperbarui', data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui perangkat' });
  }
});

// DELETE /api/customers/:customerId/devices/:deviceId - Delete device
customerRouter.delete('/:customerId/devices/:deviceId', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { customerId, deviceId } = req.params;

    const deleted = await reqDb(req)('devices')
      .where({ id: deviceId, customer_id: customerId, tenant_id })
      .delete();

    if (!deleted) {
      res.status(404).json({ error: 'Perangkat tidak ditemukan' });
      return;
    }

    res.json({ message: 'Perangkat berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus perangkat' });
  }
});
