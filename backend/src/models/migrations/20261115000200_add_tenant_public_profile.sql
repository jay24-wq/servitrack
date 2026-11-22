ALTER TABLE tenants
  ADD COLUMN description text,
  ADD COLUMN email varchar(150),
  ADD CONSTRAINT ck_tenants_description_length
    CHECK (description IS NULL OR length(description) <= 1000);

UPDATE tenants AS t
SET email = (
  SELECT u.email
  FROM users AS u
  JOIN roles AS r ON r.id = u.role_id
  WHERE u.tenant_id = t.id
    AND r.code = 'admin'
    AND u.deleted_at IS NULL
  ORDER BY u.created_at
  LIMIT 1
)
WHERE t.email IS NULL;
