WITH normalized AS (
  SELECT
    id,
    nullif(btrim(technician_diagnosis), '') AS diagnosis,
    nullif(btrim(additional_damage), '') AS damage,
    nullif(btrim(technician_note), '') AS note
  FROM public.service_tickets
)
UPDATE public.service_tickets AS ticket
SET technician_diagnosis = concat_ws(
  E'\n\n',
  normalized.diagnosis,
  CASE
    WHEN normalized.damage IS NOT NULL AND normalized.damage IS DISTINCT FROM normalized.diagnosis
      THEN normalized.damage
  END,
  CASE
    WHEN normalized.note IS NOT NULL
      AND normalized.note IS DISTINCT FROM normalized.diagnosis
      AND normalized.note IS DISTINCT FROM normalized.damage
      THEN normalized.note
  END
)
FROM normalized
WHERE ticket.id = normalized.id
  AND (
    nullif(btrim(ticket.additional_damage), '') IS NOT NULL
    OR nullif(btrim(ticket.technician_note), '') IS NOT NULL
  );
