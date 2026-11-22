ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_tickets_tenant_idempotency_key
  ON public.service_tickets (tenant_id, branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
