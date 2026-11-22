CREATE TABLE tenant_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants (id) ON DELETE CASCADE,
  event_preferences jsonb NOT NULL DEFAULT '{
    "booking_new": false,
    "booking_pickup_new": false,
    "booking_cancelled": false,
    "courier_assignment_new": false,
    "courier_assignment_pending": false,
    "pickup_today": false,
    "delivery_today": false,
    "device_ready_diagnosis": false,
    "device_ready_repair": false,
    "device_repair_complete": false,
    "booking_capacity_nearly_full": false,
    "queue_over_capacity": false,
    "subscription_expiring": false,
    "user_quota_nearly_full": false,
    "branch_quota_nearly_full": false
  }'::jsonb,
  channels jsonb NOT NULL DEFAULT '{"whatsapp": true, "email": false, "in_app": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_tenant_notification_event_preferences_object CHECK (jsonb_typeof(event_preferences) = 'object'),
  CONSTRAINT ck_tenant_notification_channels_object CHECK (jsonb_typeof(channels) = 'object')
);

INSERT INTO tenant_notification_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE tenant_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_notification_settings_tenant_policy ON tenant_notification_settings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
