import type { Knex } from 'knex';

export const BOOKING_WINDOW_DAYS = 30;

const WITA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' });
type BookingSlotInsert = {
  tenant_id: string;
  branch_id: string;
  slot_date: string;
  capacity: number;
  booked_count: number;
  is_open: boolean;
};

type OperatingDay = { is_open: boolean };

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isoWeekday(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

async function getOperatingDays(trx: Knex.Transaction, tenantId: string) {
  const rows = await trx('tenant_operating_hours').where({ tenant_id: tenantId }).select('weekday', 'is_open');
  return new Map<number, OperatingDay>(rows.map((row) => [Number(row.weekday), { is_open: Boolean(row.is_open) }]));
}

async function getTenantBookingCapacity(trx: Knex.Transaction, tenantId: string) {
  const tenant = await trx('tenants').where({ id: tenantId }).select('default_booking_capacity').first();
  if (!tenant) throw new Error('Tenant booking capacity tidak ditemukan');
  return Number(tenant.default_booking_capacity);
}

function isScheduledOpen(date: string, schedule: Map<number, OperatingDay>) {
  const configuredDay = schedule.get(isoWeekday(date));
  return configuredDay ? configuredDay.is_open : new Date(`${date}T00:00:00Z`).getUTCDay() !== 0;
}

async function syncSlotOpening(trx: Knex.Transaction, tenantId: string, branchId: string, startDate: string, days: number, schedule: Map<number, OperatingDay>) {
  const endDate = addDays(startDate, days - 1);
  const slots = await trx('booking_slots')
    .where({ tenant_id: tenantId, branch_id: branchId })
    .whereBetween('slot_date', [startDate, endDate])
    .select('slot_date');
  const exceptions = await trx('booking_calendar_exceptions')
    .where({ tenant_id: tenantId, branch_id: branchId })
    .whereBetween('slot_date', [startDate, endDate])
    .select('slot_date', 'status');
  const exceptionByDate = new Map(exceptions.map((exception) => [String(exception.slot_date).slice(0, 10), exception.status]));

  for (const slot of slots) {
    const date = String(slot.slot_date).slice(0, 10);
    const status = exceptionByDate.get(date);
    const isOpen = status === 'closed' ? false : isScheduledOpen(date, schedule);
    await trx('booking_slots').where({ tenant_id: tenantId, branch_id: branchId, slot_date: slot.slot_date }).update({ is_open: isOpen });
  }
}

export async function syncBookingSlotOperatingHours(
  trx: Knex.Transaction,
  tenantId: string,
  branchId: string,
  startDate = WITA_DATE.format(new Date()),
  days = BOOKING_WINDOW_DAYS,
) {
  const schedule = await getOperatingDays(trx, tenantId);
  await syncSlotOpening(trx, tenantId, branchId, startDate, days, schedule);
}

/** Ensures the booking window exists without changing existing capacity or bookings. */
export async function ensureBookingSlots(
  trx: Knex.Transaction,
  tenantId: string,
  branchId: string,
  startDate = WITA_DATE.format(new Date()),
  days = BOOKING_WINDOW_DAYS,
) {
  const defaultCapacity = await getTenantBookingCapacity(trx, tenantId);
  const schedule = await getOperatingDays(trx, tenantId);
  const slots: BookingSlotInsert[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const slotDate = addDays(startDate, offset);
    slots.push({
      tenant_id: tenantId,
      branch_id: branchId,
      slot_date: slotDate,
      capacity: defaultCapacity,
      booked_count: 0,
      is_open: isScheduledOpen(slotDate, schedule),
    });
  }

  if (slots.length) await trx('booking_slots').insert(slots).onConflict(['branch_id', 'slot_date']).ignore();
  await syncSlotOpening(trx, tenantId, branchId, startDate, days, schedule);

  const exceptions = await trx('booking_calendar_exceptions')
    .where({ tenant_id: tenantId, branch_id: branchId })
    .whereBetween('slot_date', [startDate, addDays(startDate, days - 1)])
    .select('slot_date', 'status', 'capacity_override');

  for (const exception of exceptions) {
    await trx('booking_slots')
      .where({ tenant_id: tenantId, branch_id: branchId, slot_date: exception.slot_date })
      .update({
        capacity: exception.status === 'limited' ? Number(exception.capacity_override ?? defaultCapacity) : defaultCapacity,
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
  const schedule = await getOperatingDays(trx, tenantId);
  const defaultCapacity = await getTenantBookingCapacity(trx, tenantId);
  const scheduleOpen = isScheduledOpen(slotDate, schedule);
  const patch = exception
    ? {
        capacity: exception.status === 'limited' ? Number(exception.capacity_override ?? defaultCapacity) : defaultCapacity,
        is_open: exception.status !== 'closed' && scheduleOpen,
      }
    : { capacity: defaultCapacity, is_open: scheduleOpen };
  await trx('booking_slots')
    .where({ tenant_id: tenantId, branch_id: branchId, slot_date: slotDate })
    .where('booked_count', '<=', patch.capacity)
    .update(patch);
}
