-- Give a subscription a durable pointer to WHICH plan it is on.
--
-- A subscription stored only `plan_name` ("Premium"), while catalog plans were identified
-- positionally. So "which plan is this?" was answerable only by string-matching a label
-- against a region's array — which breaks the moment a catalog label is edited, and breaks
-- entirely if the user's region changed since they subscribed. That is not a foundation for
-- telling someone they upgraded.
--
-- plan_id is stable and shared ACROSS regions (netflix_standard is the same plan in EGP and
-- SAR), so it survives both. catalog_region records which region's pricing they were on, so
-- a later price comparison is against the right column rather than wherever they are now.
--
-- Both nullable: a custom (non-catalog) subscription has neither, and rows that predate this
-- keep working — they simply do not get plan-change detection.
-- Plain text, not FK: the catalog is code, not a table.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS catalog_region text;

COMMENT ON COLUMN public.subscriptions.plan_id IS
  'Stable catalog plan id (e.g. netflix_standard), shared across regions. Null for custom subscriptions.';
COMMENT ON COLUMN public.subscriptions.catalog_region IS
  'Catalog region whose pricing this subscription was set up against (uae | egypt | saudi).';
