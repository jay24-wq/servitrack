-- Smoke test skema ServiTrack
-- Jalankan terhadap database kosong yang sudah dijalankan 001_init.sql:
--   psql -U postgres -d servitrack_test -v ON_ERROR_STOP=1 -f 001_init.sql -f schema-smoke.sql

\set ON_ERROR_STOP on

insert into tenants (name, slug, owner_name, phone)
values ('Toko A', 'toko-a', 'Andi', '628111111111'),
       ('Toko B', 'toko-b', 'Budi', '628222222222');

insert into branches (tenant_id, name, is_main)
select t.id, 'Cabang Utama', true from tenants t;

insert into users (tenant_id, branch_id, role_id, name, email, password_hash)
select b.tenant_id, b.id, r.id, 'Frontdesk A', 'fd@a.test', 'hash'
  from branches b
  join tenants t on t.id = b.tenant_id
  join roles r on r.code = 'frontdesk'
 where t.slug = 'toko-a';

insert into customers (tenant_id, name, phone_wa)
select id, 'Pelanggan A', '628911111111' from tenants where slug = 'toko-a';

insert into devices (tenant_id, customer_id, category, brand)
select c.tenant_id, c.id, 'hp', 'Xiaomi'
  from customers c
  join tenants t on t.id = c.tenant_id
 where t.slug = 'toko-a';

insert into service_tickets (
  tenant_id, branch_id, customer_id, device_id, received_by,
  ticket_code, tracking_token, service_method, complaint
)
select d.tenant_id,
       (select id from branches where tenant_id = d.tenant_id),
       (select id from customers where tenant_id = d.tenant_id),
       d.id,
       (select id from users where tenant_id = d.tenant_id),
       'SRV000000000000001', 'token1', 'dropoff', 'Layar mati total'
  from devices d;

-- 1. jumlah tabel sesuai rancangan
do $$
begin
  if (select count(*) from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE') <> 26 then
    raise exception 'FAIL: jumlah tabel tidak 26';
  end if;
  raise notice 'PASS: 26 tabel';
end;
$$;

-- 2. tenant_id anak wajib sama dengan tenant_id induk
do $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_customer_other uuid;
  v_device uuid;
  v_user uuid;
begin
  select id into v_tenant from tenants where slug = 'toko-a';
  select id into v_branch from branches where tenant_id = v_tenant;
  select c.id into v_customer_other from customers c
    join tenants t on t.id = c.tenant_id where t.slug = 'toko-b';
  select id into v_device from devices where tenant_id = v_tenant;
  select id into v_user from users where tenant_id = v_tenant;

  begin
    insert into service_tickets (
      tenant_id, branch_id, customer_id, device_id, received_by,
      ticket_code, tracking_token, service_method, complaint
    ) values (v_tenant, v_branch, v_customer_other, v_device, v_user,
              'SRV000000000000002', 'token2', 'dropoff', 'x');
    raise exception 'FAIL: customer lintas tenant diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: customer lintas tenant ditolak';
  end;
end;
$$;

-- 3. status tiket di luar enum ditolak
do $$
begin
  begin
    update service_tickets set current_status = 'batal' where ticket_code = 'SRV000000000000001';
    raise exception 'FAIL: status invalid diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: status tiket invalid ditolak';
  end;
end;
$$;

-- 4. satu tenant hanya boleh punya satu cabang utama
do $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from branches limit 1;
  begin
    insert into branches (tenant_id, name, is_main) values (v_tenant, 'Cabang Kedua', true);
    raise exception 'FAIL: cabang utama ganda diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: cabang utama ganda ditolak';
  end;
end;
$$;

-- 5. booking slot tidak boleh melebihi kapasitas
do $$
declare
  v_tenant uuid;
  v_branch uuid;
begin
  select id into v_tenant from tenants where slug = 'toko-a';
  select id into v_branch from branches where tenant_id = v_tenant;
  insert into booking_slots (tenant_id, branch_id, slot_date, capacity)
  values (v_tenant, v_branch, current_date + 1, 1);

  begin
    update booking_slots set booked_count = 2 where branch_id = v_branch;
    raise exception 'FAIL: kuota slot terlampaui diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: kuota slot ditolak';
  end;
end;
$$;

-- 6. stok part tidak boleh negatif
do $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_part uuid;
begin
  select id into v_tenant from tenants where slug = 'toko-a';
  select id into v_branch from branches where tenant_id = v_tenant;
  insert into parts (tenant_id, branch_id, sku, name, unit, stock_qty, min_stock, cost_price, sell_price)
  values (v_tenant, v_branch, 'SKU-001', 'Layar', 'pcs', 1, 1, 100000, 150000)
  returning id into v_part;

  begin
    update parts set stock_qty = -1 where id = v_part;
    raise exception 'FAIL: stok negatif diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: stok negatif ditolak';
  end;
end;
$$;

-- 7. hanya satu langganan aktif per toko
do $$
declare
  v_tenant uuid;
  v_plan uuid;
begin
  select id into v_tenant from tenants where slug = 'toko-a';
  select id into v_plan from plans limit 1;
  if v_plan is null then
    insert into plans (code, name, price_monthly, max_users, max_tickets_per_month,
                       has_whatsapp, has_quotation, has_multi_branch, has_courier)
    values ('starter', 'Starter', 0, 3, 100, false, false, false, false)
    returning id into v_plan;
  end if;

  insert into subscriptions (tenant_id, plan_id, period_start, period_end)
  values (v_tenant, v_plan, current_date, current_date + 30);

  begin
    insert into subscriptions (tenant_id, plan_id, period_start, period_end)
    values (v_tenant, v_plan, current_date, current_date + 30);
    raise exception 'FAIL: langganan aktif ganda diterima';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: langganan aktif ganda ditolak';
  end;
end;
$$;

-- 8. trigger tenant dan updated_at terpasang
do $$
declare
  v_tenant_trigger int;
  v_updated_trigger int;
begin
  select count(*) into v_tenant_trigger
    from pg_trigger
   where tgname like 'trg_tenant_%' and not tgisinternal;
  select count(*) into v_updated_trigger
    from pg_trigger
   where tgname = 'trg_set_updated_at' and not tgisinternal;

  if v_tenant_trigger < 20 then
    raise exception 'FAIL: trigger tenant kurang (%)', v_tenant_trigger;
  end if;
  if v_updated_trigger < 26 then
    raise exception 'FAIL: trigger updated_at kurang (%)', v_updated_trigger;
  end if;
  raise notice 'PASS: trigger tenant (%) dan updated_at (%)', v_tenant_trigger, v_updated_trigger;
end;
$$;

select 'SMOKE TEST SELESAI' as hasil;
