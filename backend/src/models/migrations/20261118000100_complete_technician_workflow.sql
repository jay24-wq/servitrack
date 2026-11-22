ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS diagnostic_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (diagnostic_fee >= 0),
  ADD COLUMN IF NOT EXISTS part_shortages jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS approval_token_hash varchar(64),
  ALTER COLUMN approval_token DROP NOT NULL;

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
-- Existing pending quotations represented sent approval links; preserve their current state semantics.
UPDATE public.quotations SET status = 'sent' WHERE status = 'pending';
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_status_check CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled', 'superseded')),
  ALTER COLUMN status SET DEFAULT 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotations_approval_token_hash ON public.quotations (approval_token_hash) WHERE approval_token_hash IS NOT NULL;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS damage_description text NOT NULL DEFAULT 'Perbaikan',
  ADD COLUMN IF NOT EXISTS labor_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  ADD COLUMN IF NOT EXISTS part_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (part_cost >= 0),
  ADD COLUMN IF NOT EXISTS part_unit_price_snapshot numeric(12,2) NOT NULL DEFAULT 0 CHECK (part_unit_price_snapshot >= 0),
  ADD COLUMN IF NOT EXISTS availability_status varchar(24),
  ADD COLUMN IF NOT EXISTS available_qty_snapshot integer CHECK (available_qty_snapshot IS NULL OR available_qty_snapshot >= 0),
  ADD COLUMN IF NOT EXISTS estimated_part_arrival_days integer CHECK (estimated_part_arrival_days IS NULL OR estimated_part_arrival_days > 0),
  ADD CONSTRAINT quotation_items_availability_status_check CHECK (
    availability_status IS NULL OR availability_status IN ('TERSEDIA', 'TIDAK_TERSEDIA', 'TERSEDIA_SEBAGIAN')
  );

-- Historical stock levels cannot be reconstructed; initialize legacy quote availability from the current inventory snapshot.
UPDATE public.quotation_items item
SET damage_description = item.description,
    labor_cost = CASE WHEN item.item_type = 'labor' THEN item.unit_price ELSE 0 END,
    part_cost = CASE WHEN item.item_type = 'part' THEN item.unit_price * item.qty ELSE 0 END,
    part_unit_price_snapshot = CASE WHEN item.item_type = 'part' THEN item.unit_price ELSE 0 END
WHERE item.damage_description = 'Perbaikan';

UPDATE public.quotation_items item
SET availability_status = CASE
      WHEN part.stock_qty <= 0 THEN 'TIDAK_TERSEDIA'
      WHEN part.stock_qty < item.qty THEN 'TERSEDIA_SEBAGIAN'
      ELSE 'TERSEDIA'
    END,
    available_qty_snapshot = part.stock_qty,
    estimated_part_arrival_days = CASE WHEN part.stock_qty < item.qty THEN 7 ELSE NULL END
FROM public.parts part
WHERE item.item_type = 'part' AND item.part_id = part.id AND item.availability_status IS NULL;

ALTER TABLE public.part_stock_movements
  ADD COLUMN IF NOT EXISTS reversal_of_movement_id uuid REFERENCES public.part_stock_movements (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE public.part_stock_movements DROP CONSTRAINT IF EXISTS part_stock_movements_movement_type_check;
ALTER TABLE public.part_stock_movements
  ADD CONSTRAINT part_stock_movements_movement_type_check CHECK (movement_type IN ('in', 'out', 'adjustment', 'return', 'reversal')),
  ADD CONSTRAINT part_stock_movements_reversal_check CHECK (
    (movement_type = 'reversal' AND reversal_of_movement_id IS NOT NULL AND nullif(btrim(reversal_reason), '') IS NOT NULL)
    OR (movement_type <> 'reversal' AND reversal_of_movement_id IS NULL AND reversal_reason IS NULL)
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_part_stock_movement_reversal ON public.part_stock_movements (reversal_of_movement_id) WHERE reversal_of_movement_id IS NOT NULL;

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.service_tickets (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_id uuid REFERENCES public.notification_logs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_type varchar(20) NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'customer', 'system')),
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS note text;
CREATE INDEX IF NOT EXISTS idx_audit_logs_ticket ON public.audit_logs (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_quotation ON public.audit_logs (quotation_id, created_at);

DROP FUNCTION IF EXISTS public.resolve_tenant_by_quotation_token(text);
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_quotation_token(p_token_hash text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.quotations WHERE approval_token_hash = p_token_hash LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_tenant_by_quotation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_quotation_token(text) TO servitrack_app;

CREATE OR REPLACE FUNCTION public.list_tenant_ids_for_maintenance()
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT tenants.id FROM public.tenants $$;
REVOKE ALL ON FUNCTION public.list_tenant_ids_for_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_tenant_ids_for_maintenance() TO servitrack_app;
