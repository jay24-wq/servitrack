ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS bin_location varchar(100);
