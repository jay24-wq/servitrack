import bcrypt from 'bcrypt';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const BRANCH_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID  = '33333333-3333-3333-3333-333333333333';
const FRONT_ID  = '44444444-4444-4444-4444-444444444444';
const TECH_ID   = '55555555-5555-5555-5555-555555555555';

export async function seed(knex) {
  const password_hash = await bcrypt.hash('servitrack', 10);

  const roles = await knex('roles').select('id', 'code');
  const roleId = (code) => roles.find((r) => r.code === code)?.id;
  const starter = await knex('plans').where({ code: 'starter' }).first();

  await knex('tenants')
    .insert({
      id: TENANT_ID,
      name: 'ServiTrack Demo',
      slug: 'demo',
      owner_name: 'Andra Wijaya',
      phone: '6281234567890',
      status: 'active',
    })
    .onConflict('slug').merge();

  await knex('branches')
    .insert({ id: BRANCH_ID, tenant_id: TENANT_ID, name: 'Cabang Utama', is_main: true, is_active: true })
    .onConflict('id').merge();

  const active = await knex('subscriptions').where({ tenant_id: TENANT_ID, status: 'active' }).first();
  if (!active && starter) {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 30);
    await knex('subscriptions').insert({
      tenant_id: TENANT_ID,
      plan_id: starter.id,
      status: 'active',
      period_start: start,
      period_end: end,
    });
  }

  const users = [
    { id: ADMIN_ID, role: 'admin',     name: 'Andra Wijaya',     email: 'admin@servitrack.id' },
    { id: FRONT_ID, role: 'frontdesk', name: 'Rani Kusumawati',  email: 'frontdesk@servitrack.id' },
    { id: TECH_ID,   role: 'teknisi',   name: 'Panendra Soma',    email: 'teknisi@servitrack.id' },
  ];
  for (const u of users) {
    await knex('users')
      .insert({
        id: u.id,
        tenant_id: TENANT_ID,
        branch_id: BRANCH_ID,
        role_id: roleId(u.role),
        name: u.name,
        email: u.email,
        password_hash,
        is_active: true,
      })
      .onConflict(['tenant_id', 'email']).merge({ password_hash, is_active: true, name: u.name });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  for (const d of [today, tomorrow]) {
    await knex('booking_slots')
      .insert({
        tenant_id: TENANT_ID,
        branch_id: BRANCH_ID,
        slot_date: d,
        capacity: 25,
        booked_count: 0,
        is_open: true,
      })
      .onConflict(['branch_id', 'slot_date']).ignore();
  }

  const [cust] = await knex('customers')
    .insert({ tenant_id: TENANT_ID, name: 'Pelanggan Demo', phone_wa: '628990001111' })
    .onConflict(['tenant_id', 'phone_wa']).merge().returning('*');

  const [dev] = await knex('devices')
    .insert({
      tenant_id: TENANT_ID,
      customer_id: cust.id,
      category: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 13',
      serial_number: 'DEMO-SN-0001',
    })
    .returning('*');

  await knex('service_tickets')
    .insert({
      tenant_id: TENANT_ID,
      branch_id: BRANCH_ID,
      customer_id: cust.id,
      device_id: dev.id,
      received_by: ADMIN_ID,
      ticket_code: 'SRV4829103756',
      tracking_token: 'DEMOTRACK0000000000000000000001',
      service_method: 'dropoff',
      complaint: 'Layar mati total setelah jatuh',
      current_status: 'pengerjaan',
    })
    .onConflict('ticket_code').merge();

  const ticket = await knex('service_tickets').where({ ticket_code: 'SRV4829103756' }).first();
  const hasLog = await knex('ticket_status_logs').where({ ticket_id: ticket.id }).first();
  if (!hasLog) {
    await knex('ticket_status_logs').insert([
      { tenant_id: TENANT_ID, ticket_id: ticket.id, changed_by: ADMIN_ID, to_status: 'antrian', note: 'Unit diterima' },
      { tenant_id: TENANT_ID, ticket_id: ticket.id, changed_by: ADMIN_ID, from_status: 'antrian', to_status: 'pengerjaan', note: 'Diagnosa selesai, mulai perbaikan' },
    ]);
  }
}
