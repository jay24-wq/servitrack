ALTER TABLE service_tickets ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id) ON DELETE SET NULL;

