-- =====================================================================
-- ServiTrack - skema database awal
-- Rancangan: ARCHITECTURE.md 4.1 dan ERD.md
--
-- Jalankan:
--   psql -U postgres -h localhost -d servitrack -f 001_init.sql
-- Via Docker (otomatis pada volume baru, lihat docker-compose.yml):
--   docker compose up -d postgres
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Menegakkan tenant_id anak sama dengan tenant_id induk.
-- Argumen trigger: <kolom_anak>.<tabel_induk> (induk wajib punya tenant_id).
create or replace function public.assert_tenant_match()
returns trigger
language plpgsql
as $$
declare
  spec text;
  child_col text;
  parent_table text;
  child_tenant uuid;
  child_value text;
  parent_tenant uuid;
begin
  child_tenant := (to_jsonb(new) ->> 'tenant_id')::uuid;
  if child_tenant is null then
    return new;
  end if;

  foreach spec in array tg_argv loop
    child_col := split_part(spec, '.', 1);
    parent_table := split_part(spec, '.', 2);
    child_value := to_jsonb(new) ->> child_col;

    if child_value is null then
      continue;
    end if;

    execute format('select tenant_id from %I where id = $1', parent_table)
      into parent_tenant
      using child_value::uuid;

    if parent_tenant is distinct from child_tenant then
      raise exception 'tenant mismatch: %.% (%) bukan milik tenant %',
        tg_table_name, child_col, child_value, child_tenant;
    end if;
  end loop;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3.1 plans
-- ---------------------------------------------------------------------

create table plans (
  id uuid primary key default gen_random_uuid(),
  code varchar(20) not null unique check (code in ('starter', 'pro', 'advance')),
  name varchar(50) not null,
  price_monthly numeric(12,2) not null check (price_monthly >= 0),
  max_users int check (max_users is null or max_users > 0),
  max_tickets_per_month int check (max_tickets_per_month is null or max_tickets_per_month > 0),
  has_whatsapp boolean not null,
  has_quotation boolean not null,
  has_multi_branch boolean not null,
  has_courier boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3.2 tenants
-- ---------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  slug varchar(60) not null unique,
  owner_name varchar(100) not null,
  phone varchar(20) not null,
  address text,
  status varchar(20) not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3.3 subscriptions
-- ---------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  plan_id uuid not null references plans (id) on delete restrict,
  status varchar(20) not null default 'active'
    check (status in ('active', 'grace', 'expired', 'cancelled')),
  period_start date not null,
  period_end date not null,
  grace_until date,
  auto_renew boolean not null default false,
  gateway_ref varchar(100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_subscriptions_period check (period_end > period_start)
);

create unique index uq_subscriptions_active
  on subscriptions (tenant_id)
  where status = 'active';

-- ---------------------------------------------------------------------
-- 3.4 branches
-- ---------------------------------------------------------------------

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  name varchar(100) not null,
  address text,
  phone varchar(20),
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_branches_main
  on branches (tenant_id)
  where is_main;

create index idx_branches_tenant on branches (tenant_id);

-- ---------------------------------------------------------------------
-- 3.5 roles
-- ---------------------------------------------------------------------

create table roles (
  id uuid primary key default gen_random_uuid(),
  code varchar(20) not null unique check (code in ('admin', 'frontdesk', 'teknisi', 'kurir')),
  name varchar(50) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3.6 users
-- ---------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  branch_id uuid references branches (id) on delete set null,
  role_id uuid not null references roles (id) on delete restrict,
  name varchar(100) not null,
  email varchar(150) not null,
  password_hash varchar(255) not null,
  phone varchar(20),
  is_active boolean not null default true,
  last_login_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_users_tenant_email unique (tenant_id, email)
);

create index idx_users_branch on users (branch_id);

create trigger trg_tenant_users before insert or update on users
  for each row execute function public.assert_tenant_match('branch_id.branches');

-- ---------------------------------------------------------------------
-- 3.7 customers
-- ---------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  name varchar(100) not null,
  phone_wa varchar(20) not null,
  address text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_customers_tenant_phone unique (tenant_id, phone_wa)
);

-- ---------------------------------------------------------------------
-- 3.8 devices
-- ---------------------------------------------------------------------

create table devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,
  category varchar(30) not null,
  brand varchar(50) not null,
  model varchar(80),
  serial_number varchar(80),
  device_passcode_enc text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_devices_customer on devices (customer_id);

create trigger trg_tenant_devices before insert or update on devices
  for each row execute function public.assert_tenant_match('customer_id.customers');

-- ---------------------------------------------------------------------
-- 3.9 booking_slots
-- ---------------------------------------------------------------------

create table booking_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  branch_id uuid not null references branches (id) on delete restrict,
  slot_date date not null,
  capacity int not null check (capacity > 0),
  booked_count int not null default 0 check (booked_count >= 0),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_booking_slots_branch_date unique (branch_id, slot_date),
  constraint ck_booking_slots_quota check (booked_count <= capacity)
);

create trigger trg_tenant_booking_slots before insert or update on booking_slots
  for each row execute function public.assert_tenant_match('branch_id.branches');

-- ---------------------------------------------------------------------
-- 3.10 bookings
-- ---------------------------------------------------------------------

create table bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  branch_id uuid not null references branches (id) on delete restrict,
  slot_id uuid not null references booking_slots (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,
  device_id uuid not null references devices (id) on delete restrict,
  booking_code varchar(12) not null unique,
  service_method varchar(20) not null
    check (service_method in ('dropoff', 'pickup_only', 'pickup_delivery')),
  complaint text not null,
  status varchar(20) not null default 'booked'
    check (status in ('booked', 'arrived', 'cancelled', 'no_show')),
  pickup_time varchar(20),
  pickup_area varchar(255),
  pickup_address varchar(500),
  pickup_latitude numeric(10,7),
  pickup_longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_tenant_slot on bookings (tenant_id, slot_id);
create index idx_bookings_customer on bookings (customer_id);

-- ---------------------------------------------------------------------
-- 3.10a booking_calendar_exceptions
-- ---------------------------------------------------------------------

create table booking_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  slot_date date not null,
  status varchar(10) not null check (status in ('closed', 'limited')),
  capacity_override int check (capacity_override is null or capacity_override > 0),
  title varchar(150) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_booking_calendar_exceptions_branch_date unique (branch_id, slot_date)
);

create index idx_booking_calendar_exceptions_tenant_date
  on booking_calendar_exceptions (tenant_id, slot_date);

alter table booking_calendar_exceptions enable row level security;

create policy booking_calendar_exceptions_tenant_policy on booking_calendar_exceptions
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create trigger trg_tenant_booking_calendar_exceptions
  before insert or update on booking_calendar_exceptions
  for each row execute function public.assert_tenant_match('branch_id.branches');

create trigger trg_tenant_bookings before insert or update on bookings
  for each row execute function public.assert_tenant_match(
    'branch_id.branches',
    'slot_id.booking_slots',
    'customer_id.customers',
    'device_id.devices'
  );

-- ---------------------------------------------------------------------
-- 3.11 service_tickets
-- ---------------------------------------------------------------------

create table service_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  branch_id uuid not null references branches (id) on delete restrict,
  booking_id uuid unique references bookings (id) on delete set null,
  customer_id uuid not null references customers (id) on delete restrict,
  device_id uuid not null references devices (id) on delete restrict,
  received_by uuid not null references users (id) on delete restrict,
  technician_id uuid references users (id) on delete set null,
  ticket_code varchar(18) not null unique,
  tracking_token varchar(32) not null unique,
  service_method varchar(20) not null
    check (service_method in ('dropoff', 'pickup_only', 'pickup_delivery')),
  owner_id_type varchar(20) check (owner_id_type in ('KTP', 'SIM', 'PASPOR', 'LAINNYA')),
  owner_id_number_enc text,
  complaint text not null,
  current_status varchar(20) not null default 'antrian'
    check (current_status in (
      'antrian', 'pengecekan', 'menunggu_part', 'pengerjaan',
      'quality_check', 'selesai', 'siap_diambil'
    )),
  estimated_done_at timestamptz,
  final_cost numeric(12,2),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tickets_tenant_status on service_tickets (tenant_id, current_status);
create index idx_tickets_tenant_created on service_tickets (tenant_id, created_at);
create index idx_tickets_tenant_tech_status on service_tickets (tenant_id, technician_id, current_status);
create index idx_tickets_customer on service_tickets (customer_id);
create index idx_tickets_device on service_tickets (device_id);

create trigger trg_tenant_service_tickets before insert or update on service_tickets
  for each row execute function public.assert_tenant_match(
    'branch_id.branches',
    'booking_id.bookings',
    'customer_id.customers',
    'device_id.devices',
    'received_by.users',
    'technician_id.users'
  );

-- ---------------------------------------------------------------------
-- 3.12 ticket_status_logs (append only)
-- ---------------------------------------------------------------------

create table ticket_status_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete cascade,
  changed_by uuid not null references users (id) on delete restrict,
  from_status varchar(20) check (from_status in (
    'antrian', 'pengecekan', 'menunggu_part', 'pengerjaan',
    'quality_check', 'selesai', 'siap_diambil'
  )),
  to_status varchar(20) not null check (to_status in (
    'antrian', 'pengecekan', 'menunggu_part', 'pengerjaan',
    'quality_check', 'selesai', 'siap_diambil'
  )),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ticket_status_logs_ticket on ticket_status_logs (ticket_id, created_at);

create trigger trg_tenant_ticket_status_logs before insert or update on ticket_status_logs
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'changed_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.13 ticket_photos
-- ---------------------------------------------------------------------

create table ticket_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete cascade,
  uploaded_by uuid not null references users (id) on delete restrict,
  photo_type varchar(20) not null
    check (photo_type in ('checkin', 'progress', 'final', 'handover')),
  storage_key varchar(255) not null,
  caption varchar(200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ticket_photos_ticket on ticket_photos (ticket_id);

create trigger trg_tenant_ticket_photos before insert or update on ticket_photos
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'uploaded_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.14 ticket_notes
-- ---------------------------------------------------------------------

create table ticket_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete cascade,
  author_id uuid not null references users (id) on delete restrict,
  note_type varchar(20) not null
    check (note_type in ('complaint', 'diagnosis', 'internal')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ticket_notes_ticket on ticket_notes (ticket_id);

create trigger trg_tenant_ticket_notes before insert or update on ticket_notes
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'author_id.users'
  );

-- ---------------------------------------------------------------------
-- 3.15 pickup_dropoff_requests
-- ---------------------------------------------------------------------

create table pickup_dropoff_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  booking_id uuid references bookings (id) on delete restrict,
  ticket_id uuid references service_tickets (id) on delete restrict,
  request_type varchar(20) not null check (request_type in ('pickup', 'delivery')),
  address text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  scheduled_at timestamptz,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'assigned', 'on_the_way', 'done', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_pickup_requests_linked check (booking_id is not null or ticket_id is not null)
);

create index idx_pickup_requests_booking on pickup_dropoff_requests (booking_id);
create index idx_pickup_requests_ticket on pickup_dropoff_requests (ticket_id);

create trigger trg_tenant_pickup_requests before insert or update on pickup_dropoff_requests
  for each row execute function public.assert_tenant_match(
    'booking_id.bookings',
    'ticket_id.service_tickets'
  );

-- ---------------------------------------------------------------------
-- 3.16 courier_tasks (struktur sementara)
-- ---------------------------------------------------------------------

create table courier_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  request_id uuid not null references pickup_dropoff_requests (id) on delete cascade,
  courier_id uuid references users (id) on delete set null,
  task_status varchar(20) not null default 'assigned'
    check (task_status in ('assigned', 'on_the_way', 'done', 'failed')),
  assigned_at timestamptz,
  completed_at timestamptz,
  proof_photo_key varchar(255),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_courier_tasks_request on courier_tasks (request_id);

create trigger trg_tenant_courier_tasks before insert or update on courier_tasks
  for each row execute function public.assert_tenant_match(
    'request_id.pickup_dropoff_requests',
    'courier_id.users'
  );

-- ---------------------------------------------------------------------
-- 3.19 parts (dipindah ke atas karena dipakai quotation_items)
-- ---------------------------------------------------------------------

create table parts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  branch_id uuid not null references branches (id) on delete restrict,
  sku varchar(40) not null,
  name varchar(120) not null,
  unit varchar(20) not null,
  stock_qty int not null default 0 check (stock_qty >= 0),
  min_stock int not null default 0 check (min_stock >= 0),
  cost_price numeric(12,2) not null,
  sell_price numeric(12,2) not null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_parts_tenant_branch_sku unique (tenant_id, branch_id, sku)
);

create index idx_parts_tenant_branch on parts (tenant_id, branch_id);

create trigger trg_tenant_parts before insert or update on parts
  for each row execute function public.assert_tenant_match('branch_id.branches');

-- ---------------------------------------------------------------------
-- 3.17 quotations
-- ---------------------------------------------------------------------

create table quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete restrict,
  created_by uuid not null references users (id) on delete restrict,
  approval_token varchar(64) not null unique,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  total_amount numeric(12,2) not null,
  expires_at timestamptz not null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quotations_ticket on quotations (ticket_id);

create trigger trg_tenant_quotations before insert or update on quotations
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'created_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.18 quotation_items
-- ---------------------------------------------------------------------

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  quotation_id uuid not null references quotations (id) on delete cascade,
  part_id uuid references parts (id) on delete set null,
  item_type varchar(10) not null check (item_type in ('part', 'labor')),
  description varchar(200) not null,
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quotation_items_quotation on quotation_items (quotation_id);

create trigger trg_tenant_quotation_items before insert or update on quotation_items
  for each row execute function public.assert_tenant_match(
    'quotation_id.quotations',
    'part_id.parts'
  );

-- ---------------------------------------------------------------------
-- 3.20 part_stock_movements (append only)
-- ---------------------------------------------------------------------

create table part_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  part_id uuid not null references parts (id) on delete restrict,
  ticket_id uuid references service_tickets (id) on delete set null,
  created_by uuid not null references users (id) on delete restrict,
  movement_type varchar(20) not null
    check (movement_type in ('in', 'out', 'adjustment', 'return')),
  qty int not null check (qty > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stock_movements_part on part_stock_movements (part_id, created_at);
create index idx_stock_movements_ticket on part_stock_movements (ticket_id);

create trigger trg_tenant_stock_movements before insert or update on part_stock_movements
  for each row execute function public.assert_tenant_match(
    'part_id.parts',
    'ticket_id.service_tickets',
    'created_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.21 ticket_part_usages
-- ---------------------------------------------------------------------

create table ticket_part_usages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete restrict,
  part_id uuid not null references parts (id) on delete restrict,
  quotation_item_id uuid references quotation_items (id) on delete set null,
  movement_id uuid unique references part_stock_movements (id) on delete set null,
  used_by uuid not null references users (id) on delete restrict,
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ticket_part_usages_ticket on ticket_part_usages (ticket_id);
create index idx_ticket_part_usages_part on ticket_part_usages (part_id);

create trigger trg_tenant_part_usages before insert or update on ticket_part_usages
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'part_id.parts',
    'quotation_item_id.quotation_items',
    'movement_id.part_stock_movements',
    'used_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.22 invoices
-- ---------------------------------------------------------------------

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null unique references service_tickets (id) on delete restrict,
  invoice_no varchar(30) not null unique,
  subtotal numeric(12,2) not null,
  additional_cost numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null,
  status varchar(20) not null default 'unpaid'
    check (status in ('unpaid', 'partial', 'paid')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tenant_invoices before insert or update on invoices
  for each row execute function public.assert_tenant_match('ticket_id.service_tickets');

-- ---------------------------------------------------------------------
-- 3.23 payments
-- ---------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  invoice_id uuid not null references invoices (id) on delete restrict,
  received_by uuid references users (id) on delete set null,
  method varchar(20) not null check (method in ('cash', 'qris', 'va', 'ewallet')),
  amount numeric(12,2) not null check (amount > 0),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  gateway_ref varchar(100),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_payments_gateway_ref
  on payments (gateway_ref)
  where gateway_ref is not null;

create index idx_payments_tenant_paid on payments (tenant_id, paid_at);
create index idx_payments_invoice on payments (invoice_id);

create trigger trg_tenant_payments before insert or update on payments
  for each row execute function public.assert_tenant_match(
    'invoice_id.invoices',
    'received_by.users'
  );

-- ---------------------------------------------------------------------
-- 3.24 chat_messages
-- ---------------------------------------------------------------------

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  ticket_id uuid not null references service_tickets (id) on delete cascade,
  sender_id uuid not null references users (id) on delete restrict,
  message text not null,
  attachment_key varchar(255),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_messages_ticket on chat_messages (ticket_id, created_at);

create trigger trg_tenant_chat_messages before insert or update on chat_messages
  for each row execute function public.assert_tenant_match(
    'ticket_id.service_tickets',
    'sender_id.users'
  );

-- ---------------------------------------------------------------------
-- 3.25 notification_logs
-- ---------------------------------------------------------------------

create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,
  ticket_id uuid references service_tickets (id) on delete set null,
  quotation_id uuid references quotations (id) on delete set null,
  channel varchar(20) not null default 'whatsapp' check (channel = 'whatsapp'),
  template_name varchar(60) not null,
  to_phone varchar(20) not null,
  status varchar(20) not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed')),
  provider_msg_id varchar(100),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notification_logs_tenant_status on notification_logs (tenant_id, status);

create trigger trg_tenant_notification_logs before insert or update on notification_logs
  for each row execute function public.assert_tenant_match(
    'customer_id.customers',
    'ticket_id.service_tickets',
    'quotation_id.quotations'
  );

-- ---------------------------------------------------------------------
-- 3.26 audit_logs (append only)
-- ---------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete restrict,
  user_id uuid references users (id) on delete set null,
  action varchar(50) not null,
  entity_type varchar(50) not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar(45),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audit_logs_tenant_created on audit_logs (tenant_id, created_at);

create trigger trg_tenant_audit_logs before insert or update on audit_logs
  for each row execute function public.assert_tenant_match('user_id.users');

-- ---------------------------------------------------------------------
-- updated_at otomatis untuk semua tabel
-- ---------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select table_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name = 'updated_at'
  loop
    execute format(
      'create trigger trg_set_updated_at before update on %I for each row execute function public.set_updated_at()',
      t.table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Data awal
-- ---------------------------------------------------------------------

insert into roles (code, name) values
  ('admin', 'Admin'),
  ('frontdesk', 'Frontdesk'),
  ('teknisi', 'Teknisi'),
  ('kurir', 'Kurir')
on conflict (code) do nothing;

insert into plans (
  code, name, price_monthly, max_users, max_tickets_per_month,
  has_whatsapp, has_quotation, has_multi_branch, has_courier
) values
  ('starter', 'Starter', 299000, 3, 100, false, false, false, false),
  ('pro', 'Pro', 599000, null, null, true, true, false, false),
  ('advance', 'Advance', 1599000, null, null, true, true, true, true)
on conflict (code) do nothing;

commit;
