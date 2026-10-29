export type BookingEventInput = {
  tenant_id: string;
  booking_id: string;
  event_code: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_id?: string | null;
  actor_type?: 'customer' | 'system' | 'frontdesk' | 'courier' | 'admin' | null;
  note?: string | null;
  meta?: Record<string, any>;
  created_at?: Date | string;
};

export async function logBookingEvent(input: BookingEventInput, trx: any) {
  const [row] = await trx('booking_status_logs')
    .insert({
      tenant_id: input.tenant_id,
      booking_id: input.booking_id,
      event_code: input.event_code,
      from_status: input.from_status ?? null,
      to_status: input.to_status ?? null,
      actor_id: input.actor_id ?? null,
      actor_type: input.actor_type ?? 'system',
      note: input.note ?? null,
      meta: input.meta ?? {},
      ...(input.created_at ? { created_at: input.created_at } : {}),
    })
    .returning('*');
  return row;
}
