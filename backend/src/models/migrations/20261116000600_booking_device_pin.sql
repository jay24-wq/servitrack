ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS device_pin_enc text,
  ADD COLUMN IF NOT EXISTS device_pin_refused boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS device_pin_enc text,
  ADD COLUMN IF NOT EXISTS device_pin_refused boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_bookings_device_pin_state'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT ck_bookings_device_pin_state
      CHECK (NOT device_pin_refused OR device_pin_enc IS NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_service_tickets_device_pin_state'
      AND conrelid = 'public.service_tickets'::regclass
  ) THEN
    ALTER TABLE public.service_tickets
      ADD CONSTRAINT ck_service_tickets_device_pin_state
      CHECK (NOT device_pin_refused OR device_pin_enc IS NULL);
  END IF;
END $$;
