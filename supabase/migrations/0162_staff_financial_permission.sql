-- Reading the content of a user's bank messages is its own permission (data tier T3), separate from seeing identity (users.pii).
-- Admin keeps access, as before, but now only through the audited reveal with a written reason.
UPDATE public.admin_roles
SET permissions = array_append(permissions, 'users.financial')
WHERE key = 'admin' AND NOT ('users.financial' = ANY (permissions));
