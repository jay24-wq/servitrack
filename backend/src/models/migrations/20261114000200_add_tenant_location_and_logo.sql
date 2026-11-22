ALTER TABLE tenants
  ADD COLUMN latitude numeric(10, 7),
  ADD COLUMN longitude numeric(10, 7),
  ADD COLUMN logo_data_url text,
  ADD CONSTRAINT ck_tenants_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT ck_tenants_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT ck_tenants_location_pair
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT ck_tenants_logo_data_url_size
    CHECK (logo_data_url IS NULL OR length(logo_data_url) <= 70000);
