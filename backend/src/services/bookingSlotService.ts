import type { Knex } from 'knex';

export const BOOKING_WINDOW_DAYS = 30;
export const DEFAULT_SLOT_CAPACITY = 25;

const WITA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' });
type BookingSlotInsert = {
  tenant_id: string;
  branch_id: string;
  slot_date: string;
  capacity: number;
  booked_count: number;
  is_open: boolean;
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Ensures the booking window exists without changing existing capacity or bookings. */
export async function ensureBookingSlots(
  trx: Knex.Transaction,
  tenantId: string,
  branchId: string,
  startDate = WITA_DATE.format(new Date()),
  days = BOOKING_WINDOW_DAYS,
) {
  const weekdays: BookingSlotInsert[] = [];
  const sundays: BookingSlotInsert[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const slotDate = addDays(startDate, offset);
    const row = {
      tenant_id: tenantId,
      branch_id: branchId,
      slot_date: slotDate,
      capacity: DEFAULT_SLOT_CAPACITY,
      booked_count: 0,
      is_open: true,
    };
    const target = new Date(`${slotDate}T00:00:00Z`);
    (target.getUTCDay() === 0 ? sundays : weekdays).push(row);
  }

  if (weekdays.length) {
    await trx('booking_slots').insert(weekdays).onConflict(['branch_id', 'slot_date']).ignore();
  }
  if (sundays.length) {
    await trx('booking_slots')
      .insert(sundays)
      .onConflict(['branch_id', 'slot_date'])
      .merge({ is_open: false });
  }

  const exceptions = await trx('booking_calendar_exceptions')
    .where({ tenant_id: tenantId, branch_id: branchId })
    .whereBetween('slot_date', [startDate, addDays(startDate, days - 1)])
    .select('slot_date', 'status', 'capacity_override');

  for (const exception of exceptions) {
    const isSunday = new Date(`${String(exception.slot_date).slice(0, 10)}T00:00:00Z`).getUTCDay() === 0;
    await trx('booking_slots')
      .where({ tenant_id: tenantId, branch_id: branchId, slot_date: exception.slot_date })
      .update({
        capacity: exception.status === 'limited' ? Number(exception.capacity_override ?? DEFAULT_SLOT_CAPACITY) : DEFAULT_SLOT_CAPACITY,
        is_open: exception.status !== 'closed' && !isSunday,
      });
  }
}

export async function syncBookingCalendarException(
  trx: Knex.Transaction,
  tenantId: string,
  branchId: string,
  slotDate: string,
) {
  const exception = await trx('booking_calendar_exceptions')
    .where({ tenant_id: tenantId, branch_id: branchId, slot_date: slotDate })
    .first();
  const isSunday = new Date(`${slotDate}T00:00:00Z`).getUTCDay() === 0;
  const patch = exception
    ? {
        capacity: exception.status === 'limited' ? Number(exception.capacity_override ?? DEFAULT_SLOT_CAPACITY) : DEFAULT_SLOT_CAPACITY,
        is_open: exception.status !== 'closed' && !isSunday,
      }
    : { capacity: DEFAULT_SLOT_CAPACITY, is_open: !isSunday };
  await trx('booking_slots')
    .where({ tenant_id: tenantId, branch_id: branchId, slot_date: slotDate })
    .where('booked_count', '<=', patch.capacity)
    .update(patch);
}
