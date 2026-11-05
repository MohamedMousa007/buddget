-- API-9: 2-step trust was "the device id matches a trusted_devices row", and the id is sent in plain text on every request.
-- Trust is now bound to a server-issued random secret; only its SHA-256 hex is stored. NULL = legacy row (trusted by id once,
-- then upgraded with a secret by /api/auth/device/check). Once a row has a hash the id alone never suffices.
-- Rollback: ALTER TABLE public.trusted_devices DROP COLUMN secret_hash;  (rows fall back to id-only trust)
-- Before/after: select count(*) filter (where secret_hash is null) from trusted_devices;  -- all rows null at apply (1 of 1), each upgrades on next check
ALTER TABLE public.trusted_devices ADD COLUMN IF NOT EXISTS secret_hash text;
ALTER TABLE public.trusted_devices DROP CONSTRAINT IF EXISTS trusted_devices_secret_hash_hex;
ALTER TABLE public.trusted_devices ADD CONSTRAINT trusted_devices_secret_hash_hex CHECK (secret_hash IS NULL OR secret_hash ~ '^[0-9a-f]{64}$');
