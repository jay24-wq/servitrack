ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS initial_estimate_cost numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_tickets_initial_estimate_cost_check'
  ) THEN
    ALTER TABLE service_tickets
      ADD CONSTRAINT service_tickets_initial_estimate_cost_check
      CHECK (initial_estimate_cost IS NULL OR initial_estimate_cost >= 0);
  END IF;
END $$;
