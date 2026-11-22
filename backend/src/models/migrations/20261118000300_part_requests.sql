ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS part_name_snapshot varchar(200),
  ADD COLUMN IF NOT EXISTS part_specification_snapshot text,
  ADD COLUMN IF NOT EXISTS part_is_registered boolean NOT NULL DEFAULT true;

UPDATE public.quotation_items AS item
   SET part_name_snapshot = part.name,
       part_specification_snapshot = part.spec,
       part_is_registered = true
  FROM public.parts AS part
 WHERE item.item_type = 'part'
   AND item.part_id = part.id
   AND item.part_name_snapshot IS NULL;

CREATE TABLE IF NOT EXISTS public.part_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets (id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE CASCADE,
  quotation_item_id uuid NOT NULL UNIQUE REFERENCES public.quotation_items (id) ON DELETE CASCADE,
  requested_name varchar(200) NOT NULL,
  specification text,
  qty integer NOT NULL CHECK (qty > 0),
  estimated_price numeric(12,2) NOT NULL CHECK (estimated_price >= 0),
  estimated_arrival_days integer NOT NULL CHECK (estimated_arrival_days > 0),
  status varchar(24) NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL', 'OPEN', 'ORDERED', 'RECEIVED', 'CANCELLED')),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  linked_part_id uuid REFERENCES public.parts (id) ON DELETE SET NULL,
  ordered_at timestamptz,
  received_at timestamptz,
  actual_price numeric(12,2) CHECK (actual_price IS NULL OR actual_price >= 0),
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_part_requests_branch_status
  ON public.part_requests (tenant_id, branch_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_part_requests_ticket ON public.part_requests (ticket_id, status);

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'part_requests'
       AND policyname = 'part_requests_tenant_policy'
  ) THEN
    CREATE POLICY part_requests_tenant_policy ON public.part_requests
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_tenant_part_requests ON public.part_requests;
CREATE TRIGGER trg_tenant_part_requests
  BEFORE INSERT OR UPDATE ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
    'branch_id.branches',
    'ticket_id.service_tickets',
    'quotation_id.quotations',
    'quotation_item_id.quotation_items',
    'requested_by.users',
    'linked_part_id.parts'
  );
