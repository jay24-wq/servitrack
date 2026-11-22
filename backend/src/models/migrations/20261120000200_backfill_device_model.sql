DO $$
BEGIN
  IF to_regclass('public.devices') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'brand'
    )
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'model'
    ) THEN
    RETURN;
  END IF;

  UPDATE public.devices
     SET model = brand
   WHERE (model IS NULL OR btrim(model) = '')
     AND brand IS NOT NULL
     AND btrim(brand) <> ''
     AND btrim(brand) <> '-';
END $$;
