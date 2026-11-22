ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS public_tracking_contact_visibility varchar(10) NOT NULL DEFAULT 'masked';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_tenants_public_tracking_contact_visibility'
       AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT ck_tenants_public_tracking_contact_visibility
      CHECK (public_tracking_contact_visibility IN ('full', 'masked', 'hidden'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.courier_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES public.courier_assignments(id) ON DELETE CASCADE,
  event_type varchar(16) NOT NULL CHECK (event_type IN ('assigned', 'status', 'reassigned')),
  status varchar(40) NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  courier_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  failure_reason varchar(40),
  source_location_event_id uuid REFERENCES public.courier_location_events(id) ON DELETE SET NULL,
  source_assignment_audit_id uuid REFERENCES public.courier_assignment_audits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_status_logs_assignment_created
  ON public.courier_status_logs (tenant_id, assignment_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_status_logs_location_source
  ON public.courier_status_logs (source_location_event_id)
  WHERE source_location_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_status_logs_assignment_audit_source
  ON public.courier_status_logs (source_assignment_audit_id)
  WHERE source_assignment_audit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_status_logs_initial_assignment
  ON public.courier_status_logs (assignment_id)
  WHERE event_type = 'assigned' AND source_location_event_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_status_logs_new_status
  ON public.courier_status_logs (assignment_id, status)
  WHERE event_type = 'status' AND source_location_event_id IS NULL;

ALTER TABLE public.courier_status_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS courier_status_logs_tenant_policy ON public.courier_status_logs;
CREATE POLICY courier_status_logs_tenant_policy ON public.courier_status_logs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP TRIGGER IF EXISTS trg_tenant_courier_status_logs ON public.courier_status_logs;
CREATE TRIGGER trg_tenant_courier_status_logs
  BEFORE INSERT OR UPDATE ON public.courier_status_logs
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
    'assignment_id.courier_assignments', 'actor_id.users', 'courier_id.users'
  );

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_status_logs TO %I', r);
    END IF;
  END LOOP;
END $$;

-- Backfill only copies source rows. The source logs remain untouched and each
-- copy has a unique source reference so rerunning this migration is safe.
INSERT INTO public.courier_status_logs (
  tenant_id, assignment_id, event_type, status, courier_id,
  source_location_event_id, created_at
)
SELECT e.tenant_id, e.assignment_id, 'status', e.status, NULL, e.id, e.recorded_at
  FROM public.courier_location_events e
ON CONFLICT DO NOTHING;

INSERT INTO public.courier_status_logs (
  tenant_id, assignment_id, event_type, status, actor_id, courier_id, created_at
)
SELECT a.tenant_id,
       a.id,
       'assigned',
       CASE a.assignment_type WHEN 'delivery' THEN 'SIAP_DIANTAR' ELSE 'KURIR_DITUGASKAN' END,
       a.assigned_by,
       COALESCE(
         (SELECT audit.from_courier_id
            FROM public.courier_assignment_audits audit
           WHERE audit.assignment_id = a.id
           ORDER BY audit.created_at ASC, audit.id ASC
           LIMIT 1),
         a.courier_id
       ),
       a.assigned_at
  FROM public.courier_assignments a
 WHERE a.courier_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.courier_status_logs (
  tenant_id, assignment_id, event_type, status, actor_id, courier_id,
  source_assignment_audit_id, created_at
)
SELECT audit.tenant_id,
       audit.assignment_id,
       'reassigned',
       CASE assignment.assignment_type WHEN 'delivery' THEN 'SIAP_DIANTAR' ELSE 'KURIR_DITUGASKAN' END,
       audit.changed_by,
       audit.to_courier_id,
       audit.id,
       audit.created_at
  FROM public.courier_assignment_audits audit
  JOIN public.courier_assignments assignment ON assignment.id = audit.assignment_id
ON CONFLICT DO NOTHING;

INSERT INTO public.courier_status_logs (
  tenant_id, assignment_id, event_type, status, failure_reason, created_at
)
SELECT a.tenant_id, a.id, 'status', a.status, a.failure_reason, COALESCE(a.updated_at, now())
  FROM public.courier_assignments a
 WHERE a.status IN ('PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.tracking_activity_events(p_tracking_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT b.id AS booking_id, linked_ticket.id AS ticket_id, b.tenant_id
      FROM public.bookings b
      LEFT JOIN LATERAL (
        SELECT t.id
          FROM public.service_tickets t
         WHERE t.booking_id = b.id
         ORDER BY t.created_at ASC
         LIMIT 1
      ) linked_ticket ON true
     WHERE upper(b.tracking_code) = upper(btrim(p_tracking_code))
    UNION ALL
    SELECT t.booking_id, t.id, t.tenant_id
      FROM public.service_tickets t
     WHERE (upper(t.tracking_code) = upper(btrim(p_tracking_code))
         OR upper(t.tracking_token) = upper(btrim(p_tracking_code)))
       AND NOT EXISTS (
         SELECT 1 FROM public.bookings b
          WHERE upper(b.tracking_code) = upper(btrim(p_tracking_code))
       )
     LIMIT 1
  ), events AS (
    SELECT l.id AS sort_id,
           l.created_at,
           CASE l.event_code
             WHEN 'BOOKING_CREATED' THEN 10
             WHEN 'PICKUP_REQUESTED' THEN 20
             WHEN 'PICKUP_SCHEDULED' THEN 30
             WHEN 'PICKUP_CONFIRMED' THEN 40
             WHEN 'UNIT_RECEIVED' THEN 50
             WHEN 'TICKET_ISSUED' THEN 60
             WHEN 'BOOKING_CANCELLED' THEN 110
             WHEN 'NO_SHOW' THEN 120
             ELSE 90
           END AS sort_order,
           'booking'::text AS source,
           CASE l.event_code
             WHEN 'BOOKING_CREATED' THEN 'booking_created'
             WHEN 'PICKUP_REQUESTED' THEN 'pickup_requested'
             WHEN 'PICKUP_SCHEDULED' THEN 'pickup_scheduled'
             WHEN 'PICKUP_CONFIRMED' THEN 'pickup_confirmed'
             WHEN 'UNIT_RECEIVED' THEN 'unit_received'
             WHEN 'TICKET_ISSUED' THEN 'ticket_issued'
             WHEN 'BOOKING_CANCELLED' THEN 'cancelled'
             WHEN 'NO_SHOW' THEN 'no_show'
             ELSE 'status_updated'
           END AS status,
           NULL::text AS note,
           COALESCE(
             l.actor_id,
             CASE WHEN l.event_code = 'UNIT_RECEIVED' THEN (
               SELECT ticket.received_by
                 FROM public.service_tickets ticket
                WHERE ticket.booking_id = l.booking_id
                  AND ticket.tenant_id = l.tenant_id
                ORDER BY ticket.created_at ASC
                LIMIT 1
             ) END
           ) AS staff_id
      FROM public.booking_status_logs l
      JOIN target t ON t.booking_id = l.booking_id AND t.tenant_id = l.tenant_id

    UNION ALL

    SELECT l.id,
           l.created_at,
           CASE l.to_status
             WHEN 'antrian' THEN 70
             WHEN 'pengecekan' THEN 80
             WHEN 'menunggu_persetujuan' THEN 85
             WHEN 'menunggu_part' THEN 90
             WHEN 'pengerjaan' THEN 100
             WHEN 'quality_check' THEN 110
             WHEN 'selesai' THEN 120
             WHEN 'siap_diambil' THEN 130
             WHEN 'batal' THEN 140
             ELSE 90
           END,
           'ticket',
           l.to_status,
           NULL::text,
           l.changed_by
      FROM public.ticket_status_logs l
      JOIN target t ON t.ticket_id = l.ticket_id AND t.tenant_id = l.tenant_id

    UNION ALL

    SELECT ticket.id,
           ticket.created_at,
           50,
           'ticket',
           'unit_received',
           NULL::text,
           ticket.received_by
      FROM public.service_tickets ticket
      JOIN target t ON t.ticket_id = ticket.id AND t.tenant_id = ticket.tenant_id
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.booking_status_logs booking_log
        WHERE booking_log.booking_id = ticket.booking_id
          AND booking_log.tenant_id = ticket.tenant_id
          AND booking_log.event_code = 'UNIT_RECEIVED'
     )

    UNION ALL

    SELECT l.id,
           l.created_at,
           75,
           'ticket',
           'technician_assigned',
           NULL::text,
           l.to_technician_id
      FROM public.ticket_assignment_logs l
      JOIN target t ON t.ticket_id = l.ticket_id AND t.tenant_id = l.tenant_id
     WHERE l.to_technician_id IS NOT NULL

    UNION ALL

    SELECT l.id,
           l.created_at,
           CASE
             WHEN l.event_type = 'assigned' AND a.assignment_type = 'pickup' THEN 35
             WHEN l.event_type = 'reassigned' AND a.assignment_type = 'pickup' THEN 36
             WHEN l.event_type = 'assigned' THEN 145
             WHEN l.event_type = 'reassigned' THEN 146
             WHEN l.status = 'MENUJU_LOKASI' THEN 40
             WHEN l.status = 'TIBA_DI_LOKASI' THEN 41
             WHEN l.status = 'PERANGKAT_DIJEMPUT' THEN 42
             WHEN l.status = 'MENUJU_TOKO' THEN 43
             WHEN l.status = 'PERANGKAT_TIBA_DI_WORKSHOP' THEN 44
             WHEN l.status IN ('PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE') THEN 190
             WHEN l.status = 'MENUJU_CUSTOMER' THEN 150
             WHEN l.status = 'SAMPAI_DI_LOKASI' THEN 160
             WHEN l.status = 'PERANGKAT_DISERAHKAN' THEN 170
             WHEN l.status = 'SELESAI' THEN 180
             ELSE 90
           END,
           'courier',
           CASE
             WHEN l.event_type = 'assigned' AND a.assignment_type = 'pickup' THEN 'pickup_courier_assigned'
             WHEN l.event_type = 'assigned' THEN 'delivery_courier_assigned'
             WHEN l.event_type = 'reassigned' AND a.assignment_type = 'pickup' THEN 'pickup_courier_reassigned'
             WHEN l.event_type = 'reassigned' THEN 'delivery_courier_reassigned'
             WHEN l.status IN ('PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE')
               THEN CASE a.assignment_type WHEN 'pickup' THEN 'pickup_failed' ELSE 'delivery_failed' END
             WHEN l.status = 'MENUJU_LOKASI' THEN 'pickup_courier_on_the_way'
             WHEN l.status = 'TIBA_DI_LOKASI' THEN 'pickup_courier_arrived'
             WHEN l.status = 'PERANGKAT_DIJEMPUT' THEN 'pickup_device_picked_up'
             WHEN l.status = 'MENUJU_TOKO' THEN 'pickup_courier_returning'
             WHEN l.status = 'PERANGKAT_TIBA_DI_WORKSHOP' THEN 'pickup_device_arrived'
             WHEN l.status = 'MENUJU_CUSTOMER' THEN 'delivery_courier_on_the_way'
             WHEN l.status = 'SAMPAI_DI_LOKASI' THEN 'delivery_courier_arrived'
             WHEN l.status = 'PERANGKAT_DISERAHKAN' THEN 'device_received'
             WHEN l.status = 'SELESAI' AND a.assignment_type = 'delivery' THEN 'delivery_completed'
             ELSE NULL
           END,
            CASE
              WHEN l.failure_reason = 'CUSTOMER_NOT_HOME' THEN 'Pelanggan tidak berada di lokasi'
              WHEN l.failure_reason = 'CUSTOMER_CANCELLED' AND a.assignment_type = 'pickup' THEN 'Penjemputan dibatalkan pelanggan'
              WHEN l.failure_reason = 'CUSTOMER_CANCELLED' THEN 'Pengantaran dibatalkan pelanggan'
              WHEN l.failure_reason = 'WRONG_ADDRESS' AND a.assignment_type = 'pickup' THEN 'Alamat penjemputan tidak sesuai'
              WHEN l.failure_reason = 'WRONG_ADDRESS' THEN 'Alamat tujuan tidak sesuai'
              WHEN l.failure_reason = 'UNREACHABLE' THEN 'Pelanggan tidak dapat dihubungi'
              WHEN l.failure_reason = 'OTHER' THEN 'Kendala lainnya'
              ELSE NULL
            END,
           CASE WHEN l.event_type IN ('assigned', 'reassigned') THEN l.courier_id ELSE l.actor_id END
      FROM public.courier_status_logs l
      JOIN public.courier_assignments a ON a.id = l.assignment_id AND a.tenant_id = l.tenant_id
      JOIN target t ON t.tenant_id = a.tenant_id
       AND (a.ticket_id = t.ticket_id OR a.booking_id = t.booking_id)

    UNION ALL

    SELECT i.id,
           COALESCE(max(p.paid_at), max(p.updated_at), i.updated_at),
           140,
           'payment',
           'invoice_paid',
           NULL::text,
           NULL::uuid
      FROM public.invoices i
      JOIN target t ON t.ticket_id = i.ticket_id AND t.tenant_id = i.tenant_id
      LEFT JOIN public.payments p ON p.invoice_id = i.id AND p.tenant_id = i.tenant_id AND p.status = 'paid'
     WHERE i.status = 'paid'
     GROUP BY i.id, i.updated_at
  )
  SELECT jsonb_build_object(
    'tenantId', target.tenant_id,
    'events', COALESCE(
      jsonb_agg(jsonb_build_object(
        'status', events.status,
        'note', events.note,
        'source', events.source,
        'createdAt', events.created_at,
        'staffId', events.staff_id
      ) ORDER BY events.created_at ASC, events.sort_order ASC, events.sort_id ASC)
        FILTER (WHERE events.sort_id IS NOT NULL),
      '[]'::jsonb
    )
  )
    FROM target
    LEFT JOIN events ON true
   GROUP BY target.tenant_id
$$;

REVOKE ALL ON FUNCTION public.tracking_activity_events(text) FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.tracking_activity_events(text) TO %I', r);
    END IF;
  END LOOP;
END $$;
