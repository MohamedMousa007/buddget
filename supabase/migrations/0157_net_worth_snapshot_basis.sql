-- The accounts basis changes what "net worth" means (balances replace the monthly-flow term). The trend only compares
-- snapshots taken on the same basis, so switching never shows a fake jump.
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'legacy';
