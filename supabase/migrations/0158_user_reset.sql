-- Admin "reset user account": a stamp devices compare against, and the permission granted to the admin role.
-- Devices that see a newer stamp than the one they last honoured drop their local copy and pull the (now empty) account.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_reset_at timestamptz;

UPDATE public.admin_roles
SET permissions = array_append(permissions, 'users.reset')
WHERE key = 'admin' AND NOT ('users.reset' = ANY (permissions));
