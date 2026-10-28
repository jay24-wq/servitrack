const QUEUE_PREFIX = 'A';
const QUEUE_NUMBER_SQL_PATTERN = '^A-?[0-9]+$';

/**
 * Allocates a dropoff queue number for one branch/date.
 * The slot row lock serializes all allocations for the same branch/date,
 * including the empty-queue case where no booking row exists yet.
 */
export async function nextDropoffQueueNumber(trx: any, branchId: string, slotId: string) {
  // Serialize allocation even if a future caller forgets to lock the slot row.
  await trx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`${branchId}:${slotId}`]);

  await trx('booking_slots')
    .where({ id: slotId, branch_id: branchId })
    .forUpdate()
    .first();

  const result = await trx('bookings')
    .where({ 'bookings.branch_id': branchId, 'bookings.slot_id': slotId, 'bookings.service_method': 'dropoff' })
    .whereNotNull('bookings.queue_number')
    // Accept legacy A-001 values while all new values use A001.
    .whereRaw('bookings.queue_number ~ ?', [QUEUE_NUMBER_SQL_PATTERN])
    .select(
      trx.raw(
        "COALESCE(MAX(CAST(SUBSTRING(REPLACE(bookings.queue_number, '-', '') FROM 2) AS INTEGER)), 0) AS max_queue"
      )
    )
    .first();

  const lastNumber = Number(result?.max_queue ?? 0);

  return `${QUEUE_PREFIX}${String(lastNumber + 1).padStart(3, '0')}`;
}
