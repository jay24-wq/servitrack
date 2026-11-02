import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.raw(`
    INSERT INTO booking_slots (tenant_id, branch_id, slot_date, capacity, booked_count, is_open)
    SELECT
      b.tenant_id,
      b.id,
      dates.slot_date::date,
      25,
      0,
      EXTRACT(ISODOW FROM dates.slot_date) <> 7
    FROM branches b
    CROSS JOIN generate_series(
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date + INTERVAL '29 days',
      INTERVAL '1 day'
    ) AS dates(slot_date)
    WHERE b.is_active = true
    ON CONFLICT (branch_id, slot_date) DO NOTHING
  `);
}

// Existing slots may contain bookings, so rollback must not delete business data.
export async function down(_knex: Knex) {}
