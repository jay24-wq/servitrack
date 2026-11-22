ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS error_code varchar(60),
  ADD COLUMN IF NOT EXISTS approval_url text;
