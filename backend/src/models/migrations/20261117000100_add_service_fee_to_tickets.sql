ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS service_fee numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_tickets_service_fee_check'
  ) THEN
    ALTER TABLE public.service_tickets
      ADD CONSTRAINT service_tickets_service_fee_check
      CHECK (service_fee IS NULL OR service_fee >= 0);
  END IF;
END $$;
