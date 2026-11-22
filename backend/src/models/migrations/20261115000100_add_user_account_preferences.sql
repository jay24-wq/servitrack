ALTER TABLE users
  ADD COLUMN avatar_data_url text,
  ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Asia/Jakarta',
  ADD CONSTRAINT ck_users_avatar_data_url_size
    CHECK (avatar_data_url IS NULL OR length(avatar_data_url) <= 70000);
