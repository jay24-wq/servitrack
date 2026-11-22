ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS dedupe_key varchar(250);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_logs_tenant_dedupe_key
  ON public.notification_logs (tenant_id, dedupe_key);
