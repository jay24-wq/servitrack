DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'default_booking_capacity'
  ) THEN
    ALTER TABLE public.tenants
      ADD COLUMN default_booking_capacity integer NOT NULL DEFAULT 25;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_tenants_default_booking_capacity'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT ck_tenants_default_booking_capacity
      CHECK (default_booking_capacity > 0);
  END IF;
END $$;
