ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS category varchar(80) NOT NULL DEFAULT 'Umum',
  ADD COLUMN IF NOT EXISTS spec text,
  ADD COLUMN IF NOT EXISTS bin_location varchar(100);
