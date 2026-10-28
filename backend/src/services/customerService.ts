export async function findOrCreateCustomerByPhone(
  trx: any,
  tenantId: string,
  name: string,
  phoneWa: string,
) {
  const customerName = name.trim();
  if (!customerName) throw Object.assign(new Error('Nama customer wajib diisi'), { status: 400 });

  const [created] = await trx('customers')
    .insert({ tenant_id: tenantId, name: customerName, phone_wa: phoneWa })
    .onConflict(['tenant_id', 'phone_wa'])
    .ignore()
    .returning('*');

  if (created) return created;

  const customer = await trx('customers')
    .where({ tenant_id: tenantId, phone_wa: phoneWa })
    .first();
  if (!customer) throw new Error('Customer gagal ditemukan setelah proses create');
  return customer;
}
