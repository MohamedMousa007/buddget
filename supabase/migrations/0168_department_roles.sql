-- Product, Data/AI and Compliance system roles. Built only from permissions that exist today; the AI and DSR
-- permissions are added to them when those features ship. Nobody is assigned these roles by this migration.
insert into admin_roles (key, name, description, rank, permissions, is_system) values
  ('product', 'Product', 'Usage analytics, flags and support insight. No personal data.', 20,
    array['overview.view','analytics.view','users.view','support.view','billing.view','loyalty.view','flags.view'], true),
  ('data_ai', 'Data & AI', 'Analytics, SMS pipeline and platform health for model and data quality work.', 20,
    array['overview.view','analytics.view','sms.view','flags.view','platform.view'], true),
  ('compliance', 'Compliance', 'Audit log, security events and identity lookups for privacy requests.', 20,
    array['overview.view','users.view','users.pii','support.view','audit.view','security.view'], true)
on conflict (key) do nothing;
