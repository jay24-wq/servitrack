CREATE TABLE IF NOT EXISTS public.device_columns_backup_20261120 (
  device_id uuid PRIMARY KEY,
  brand varchar(50),
  serial_number varchar(80)
);

DO $$
DECLARE
  v_source_count bigint;
  v_backup_count bigint;
  v_has_brand boolean;
  v_has_serial boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'brand'
  ) INTO v_has_brand;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'serial_number'
  ) INTO v_has_serial;

  IF v_has_brand AND v_has_serial THEN
    INSERT INTO public.device_columns_backup_20261120 (device_id, brand, serial_number)
    SELECT id, brand, serial_number FROM public.devices
    ON CONFLICT (device_id) DO NOTHING;

    SELECT count(*) INTO v_source_count FROM public.devices;
    SELECT count(*) INTO v_backup_count FROM public.device_columns_backup_20261120;
    IF v_source_count <> v_backup_count OR EXISTS (
      SELECT 1
        FROM public.devices d
        LEFT JOIN public.device_columns_backup_20261120 b ON b.device_id = d.id
       WHERE b.device_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Backup perangkat tidak lengkap: sumber %, cadangan %', v_source_count, v_backup_count;
    END IF;
  END IF;
END $$;
