-- 007_update_track_public_union_timeline.sql
-- track_public: gabungkan timeline booking_status_logs + ticket_status_logs
CREATE OR REPLACE FUNCTION public.track_public(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.service_tickets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_result jsonb;
BEGIN
  -- 1) Cari tiket (kode tiket / tracking token)
  SELECT * INTO v_ticket
    FROM public.service_tickets
   WHERE lower(ticket_code) = lower(p_code)
      OR lower(tracking_token) = lower(p_code)
   LIMIT 1;

  -- 2) Tentukan booking yang terkait
  IF v_ticket.id IS NOT NULL AND v_ticket.booking_id IS NOT NULL THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_ticket.booking_id LIMIT 1;
  END IF;

  IF v_booking.id IS NULL THEN
    SELECT * INTO v_booking
      FROM public.bookings
     WHERE lower(booking_code) = lower(p_code)
     LIMIT 1;
  END IF;

  IF v_booking.id IS NULL AND v_ticket.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2b) Kalau kode yang dipakai adalah booking_code, ambil tiket yang terkait (bila sudah ada)
  IF v_ticket.id IS NULL AND v_booking.id IS NOT NULL THEN
    SELECT * INTO v_ticket
      FROM public.service_tickets
     WHERE booking_id = v_booking.id
     LIMIT 1;
  END IF;

  -- 3) Susun hasil
  IF v_ticket.id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ticket_code',       t.ticket_code,
      'booking_code',      bk.booking_code,
      'booking_id',        t.booking_id,      'current_status',    t.current_status,
      'service_method',    t.service_method,
      'complaint',         t.complaint,
      'estimated_done_at', t.estimated_done_at,
      'final_cost',        t.final_cost,
      'created_at',        t.created_at,
      'completed_at',      t.completed_at,
      'customer_name',     c.name,
      'device', jsonb_build_object(
        'category', d.category, 'brand', d.brand, 'model', d.model, 'serial_number', d.serial_number
      ),
      'branch_name', b.name,
      'status_logs', COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object('to_status', l.to_status, 'note', l.note, 'created_at', l.created_at)
                 ORDER BY l.created_at
               )
          FROM public.ticket_status_logs l
         WHERE l.ticket_id = t.id
      ), '[]'::jsonb),
      'timeline', COALESCE((
        SELECT jsonb_agg(e ORDER BY e.created_at)
        FROM (
          SELECT jsonb_build_object(
                   'source', 'booking',
                   'event_code', bl.event_code,
                   'label', COALESCE(bl.note, bl.event_code),
                   'note', bl.note,
                   'created_at', bl.created_at,
                   'meta', bl.meta
                 ) AS e,
                 bl.created_at AS created_at
          FROM public.booking_status_logs bl
         WHERE bl.booking_id = t.booking_id
          UNION ALL
          SELECT jsonb_build_object(
                   'source', 'ticket',
                   'event_code', l.to_status,
                   'label', COALESCE(l.note, l.to_status),
                   'note', l.note,
                   'created_at', l.created_at,
                   'meta', jsonb_build_object('to_status', l.to_status)
                 ) AS e,
                 l.created_at AS created_at
          FROM public.ticket_status_logs l
         WHERE l.ticket_id = t.id
        ) e
      ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.service_tickets t
    LEFT JOIN public.bookings  bk ON bk.id = t.booking_id
    JOIN public.customers c ON c.id = t.customer_id
    JOIN public.devices   d ON d.id = t.device_id
    JOIN public.branches  b ON b.id = t.branch_id
    WHERE t.id = v_ticket.id;

    RETURN v_result;
  END IF;

  -- 4) Belum ada tiket -> tracking dari booking saja
  SELECT jsonb_build_object(
    'ticket_code',      NULL,
    'booking_code',      bk.booking_code,
    'booking_id',        bk.id,
    'current_status',    bk.status,
    'service_method',    bk.service_method,
    'complaint',         bk.complaint,
    'estimated_done_at', NULL,
    'final_cost',        NULL,
    'created_at',        bk.created_at,
    'completed_at',      NULL,
    'customer_name',     c.name,
    'device', jsonb_build_object(
      'category', d.category, 'brand', d.brand, 'model', d.model, 'serial_number', d.serial_number
    ),
    'branch_name',       br.name,
    'status_logs',       '[]'::jsonb,
    'timeline', COALESCE((
      SELECT jsonb_agg(e ORDER BY e.created_at)
      FROM (
        SELECT jsonb_build_object(
                 'source', 'booking',
                 'event_code', bl.event_code,
                 'label', COALESCE(bl.note, bl.event_code),
                 'note', bl.note,
                 'created_at', bl.created_at,
                 'meta', bl.meta
               ) AS e,
               bl.created_at AS created_at
        FROM public.booking_status_logs bl
       WHERE bl.booking_id = bk.id
      ) e
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.bookings bk
  JOIN public.customers c ON c.id = bk.customer_id
  JOIN public.devices   d ON d.id = bk.device_id
  JOIN public.branches  br ON br.id = bk.branch_id
  WHERE bk.id = v_booking.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.track_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_public(text) TO servitrack_app;
