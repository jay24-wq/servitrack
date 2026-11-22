const restoreSql = `
  DO $$
  BEGIN
    IF to_regclass('public.device_columns_backup_20261120') IS NULL THEN
      RAISE EXCEPTION 'Cadangan kolom perangkat tidak ditemukan';
    END IF;
  END $$;

  ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS serial_number varchar(80);

  UPDATE public.devices d
     SET serial_number = b.serial_number
    FROM public.device_columns_backup_20261120 b
   WHERE b.device_id = d.id;
`;

export async function up(knex) {
  await knex.raw(`
    DO $$
    DECLARE
      v_source_count bigint;
      v_backup_count bigint;
      v_has_serial boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'serial_number'
      ) INTO v_has_serial;
      IF v_has_serial THEN
        IF to_regclass('public.device_columns_backup_20261120') IS NULL THEN
          RAISE EXCEPTION 'Cadangan kolom perangkat tidak ditemukan';
        END IF;
        SELECT count(*) INTO v_source_count FROM public.devices;
        SELECT count(*) INTO v_backup_count FROM public.device_columns_backup_20261120;
        IF v_source_count <> v_backup_count OR EXISTS (
          SELECT 1 FROM public.devices d
          LEFT JOIN public.device_columns_backup_20261120 b ON b.device_id = d.id
          WHERE b.device_id IS NULL
        ) THEN
          RAISE EXCEPTION 'Cadangan perangkat tidak lengkap: sumber %, cadangan %', v_source_count, v_backup_count;
        END IF;
      END IF;
    END $$;

    ALTER TABLE public.devices DROP COLUMN IF EXISTS serial_number;
  `);
}

export async function down(knex) {
  await knex.raw(restoreSql);
}
