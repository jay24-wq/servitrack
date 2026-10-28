-- 009_update_track_public_tracking.sql
-- Tracking publik HANYA memakai tracking_code (nomor resi customer).
-- booking_code dan ticket_code tidak pernah dikembalikan ke customer.
-- Timeline = booking_status_logs + ticket_status_logs, urut created_at ASC.

DROP FUNCTION IF EXISTS public.track_public(text);

CREATE FUNCTION public.track_public(p_tracking_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_ticket public.service_tickets%ROWTYPE;
  v_timeline jsonb;
  v_current_status text;
  v_result jsonb;
BEGIN
  IF p_tracking_code IS NULL OR btrim(p_tracking_code) = '' THEN
    RETURN NULL;
  END IF;

  -- 1) Cari booking berdasarkan nomor resi.
  SELECT * INTO v_booking
    FROM public.bookings
   WHERE upper(tracking_code) = upper(btrim(p_tracking_code))
   LIMIT 1;

  -- 2) Kalau ada, ambil service ticket yang terkait.
  IF v_booking.id IS NOT NULL THEN
    SELECT * INTO v_ticket
      FROM public.service_tickets
     WHERE booking_id = v_booking.id
     LIMIT 1;
  ELSE
    -- 3) Fallback untuk walk-in: cari tiket langsung dari nomor resi.
    SELECT * INTO v_ticket
      FROM public.service_tickets
     WHERE upper(tracking_code) = upper(btrim(p_tracking_code))
     LIMIT 1;

    IF v_ticket.booking_id IS NOT NULL THEN
      SELECT * INTO v_booking
        FROM public.bookings
       WHERE id = v_ticket.booking_id
       LIMIT 1;
    END IF;
  END IF;

  IF v_booking.id IS NULL AND v_ticket.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 4) Timeline gabungan. sort_order hanya untuk event yang created_at-nya
  -- sama dalam satu transaksi (mis. BOOKING_CREATED + PICKUP_*).
  SELECT COALESCE(
           jsonb_agg(t.event ORDER BY t.created_at ASC, t.sort_order ASC, t.sort_id ASC),
           '[]'::jsonb
         )
    INTO v_timeline
    FROM (
      SELECT
        bl.created_at,
        bl.id::text AS sort_id,
        CASE bl.event_code
          WHEN 'BOOKING_CREATED'   THEN 10
          WHEN 'PICKUP_REQUESTED'  THEN 20
          WHEN 'PICKUP_SCHEDULED'  THEN 30
          WHEN 'PICKUP_CONFIRMED'  THEN 40
          WHEN 'UNIT_RECEIVED'     THEN 50
          WHEN 'TICKET_ISSUED'     THEN 60
          WHEN 'BOOKING_CANCELLED' THEN 120
          WHEN 'NO_SHOW'           THEN 130
          ELSE 90
        END AS sort_order,
        jsonb_build_object(
          'status', CASE bl.event_code
            WHEN 'BOOKING_CREATED'   THEN 'booking_created'
            WHEN 'PICKUP_REQUESTED'  THEN 'pickup_requested'
            WHEN 'PICKUP_SCHEDULED'  THEN 'pickup_scheduled'
            WHEN 'PICKUP_CONFIRMED'  THEN 'pickup_confirmed'
            WHEN 'UNIT_RECEIVED'     THEN 'unit_received'
            WHEN 'TICKET_ISSUED'     THEN 'ticket_issued'
            WHEN 'BOOKING_CANCELLED' THEN 'cancelled'
            WHEN 'NO_SHOW'           THEN 'no_show'
            ELSE lower(bl.event_code)
          END,
          'note', bl.note,
          'source', 'booking',
          'createdAt', bl.created_at
        ) AS event
      FROM public.booking_status_logs bl
      WHERE bl.booking_id = v_booking.id

      UNION ALL

      SELECT
        l.created_at,
        l.id::text AS sort_id,
        CASE l.to_status
          WHEN 'antrian'       THEN 70
          WHEN 'pengecekan'    THEN 80
          WHEN 'menunggu_part' THEN 90
          WHEN 'pengerjaan'    THEN 100
          WHEN 'quality_check' THEN 110
          WHEN 'selesai'       THEN 120
          WHEN 'siap_diambil'  THEN 130
          ELSE 90
        END AS sort_order,
        jsonb_build_object(
          'status', l.to_status,
          'note', l.note,
          'source', 'ticket',
          'createdAt', l.created_at
        ) AS event
      FROM public.ticket_status_logs l
      WHERE l.ticket_id = v_ticket.id
    ) t;

  -- 5. Status saat ini: status tiket bila sudah ada, kalau belum pakai
  -- event booking terakhir.
  IF v_ticket.id IS NOT NULL THEN
    v_current_status := v_ticket.current_status;
  ELSE
    SELECT CASE bl.event_code
             WHEN 'BOOKING_CREATED'   THEN 'booking_created'
             WHEN 'PICKUP_REQUESTED'  THEN 'pickup_requested'
             WHEN 'PICKUP_SCHEDULED'  THEN 'pickup_scheduled'
             WHEN 'PICKUP_CONFIRMED'  THEN 'pickup_confirmed'
             WHEN 'UNIT_RECEIVED'     THEN 'unit_received'
             WHEN 'TICKET_ISSUED'     THEN 'ticket_issued'
             WHEN 'BOOKING_CANCELLED' THEN 'cancelled'
             WHEN 'NO_SHOW'           THEN 'no_show'
             ELSE lower(bl.event_code)
           END
      INTO v_current_status
      FROM public.booking_status_logs bl
     WHERE bl.booking_id = v_booking.id
     ORDER BY bl.created_at DESC,
              CASE bl.event_code
                WHEN 'BOOKING_CREATED'   THEN 10
                WHEN 'PICKUP_REQUESTED'  THEN 20
                WHEN 'PICKUP_SCHEDULED'  THEN 30
                WHEN 'PICKUP_CONFIRMED'  THEN 40
                WHEN 'UNIT_RECEIVED'     THEN 50
                WHEN 'TICKET_ISSUED'     THEN 60
                WHEN 'BOOKING_CANCELLED' THEN 120
                WHEN 'NO_SHOW'           THEN 130
                ELSE 90
              END DESC,
              bl.id DESC
     LIMIT 1;

    IF v_current_status IS NULL THEN
      v_current_status := CASE v_booking.status
        WHEN 'booked'    THEN 'booking_created'
        WHEN 'arrived'   THEN 'unit_received'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'no_show'   THEN 'no_show'
        ELSE v_booking.status
      END;
    END IF;
  END IF;

  -- 6) Response customer. Tidak ada booking_code / ticket_code.
  SELECT jsonb_build_object(
           'trackingCode', COALESCE(v_booking.tracking_code, v_ticket.tracking_code),
           'currentStatus', v_current_status,
           'serviceMethod', COALESCE(v_ticket.service_method, v_booking.service_method),
           'complaint', COALESCE(v_ticket.complaint, v_booking.complaint),
           'estimatedDoneAt', v_ticket.estimated_done_at,
           'finalCost', v_ticket.final_cost,
           'createdAt', COALESCE(v_booking.created_at, v_ticket.created_at),
           'completedAt', v_ticket.completed_at,
           'customerName', c.name,
           'device', jsonb_build_object(
             'category', d.category,
             'brand', d.brand,
             'model', d.model,
             'serialNumber', d.serial_number
           ),
           'branchName', b.name,
           'timeline', v_timeline
         )
    INTO v_result
    FROM public.customers c
    JOIN public.devices d
      ON d.id = COALESCE(v_ticket.device_id, v_booking.device_id)
    JOIN public.branches b
      ON b.id = COALESCE(v_ticket.branch_id, v_booking.branch_id)
   WHERE c.id = COALESCE(v_ticket.customer_id, v_booking.customer_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.track_public(text) FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.track_public(text) TO %I', r);
    END IF;
  END LOOP;
END $$;
