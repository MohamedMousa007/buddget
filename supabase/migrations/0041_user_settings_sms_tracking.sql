-- Add sms_tracking_enabled column to user_settings.
-- Synced from AppSettings.smsTrackingEnabled on every settings save.

alter table public.user_settings
  add column if not exists sms_tracking_enabled boolean not null default false;
