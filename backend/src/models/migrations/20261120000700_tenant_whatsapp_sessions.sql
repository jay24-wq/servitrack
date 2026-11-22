ALTER TABLE public.tenant_notification_settings
  ADD COLUMN IF NOT EXISTS openwa_session_id varchar(128),
  ADD COLUMN IF NOT EXISTS openwa_session_status varchar(30),
  ADD COLUMN IF NOT EXISTS openwa_connected_phone varchar(20),
  ADD COLUMN IF NOT EXISTS openwa_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_notification_settings_openwa_session
  ON public.tenant_notification_settings (openwa_session_id)
  WHERE openwa_session_id IS NOT NULL;

ALTER TABLE public.notification_logs
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS notification_type varchar(30) NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_notification_logs_type'
      AND conrelid = 'public.notification_logs'::regclass
  ) THEN
    ALTER TABLE public.notification_logs
      ADD CONSTRAINT ck_notification_logs_type
      CHECK (notification_type IN ('customer', 'connection_test'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_type_created
  ON public.notification_logs (tenant_id, notification_type, created_at DESC);
