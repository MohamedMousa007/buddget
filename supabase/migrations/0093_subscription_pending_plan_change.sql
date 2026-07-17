-- Hold a DETECTED-but-unconfirmed plan change on the subscription.
--
-- When a tracked SMS payment lands squarely on a different catalog plan of the same brand,
-- matchSubscription already recognises it (planChange). Per product decision it is NOT
-- auto-applied — a proration or promo could look like a switch — so the detection is
-- parked here and the app prompts the user, who confirms or dismisses.
--
-- On confirm: plan_id/plan_name/amount adopt the pending values, both columns clear.
-- On dismiss: both columns clear, nothing else changes.
-- Both nullable; a subscription with no pending change has them null.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id text,
  ADD COLUMN IF NOT EXISTS pending_amount numeric;

COMMENT ON COLUMN public.subscriptions.pending_plan_id IS
  'A catalog plan id a tracked payment suggests the user moved to, awaiting confirmation. Null = no pending change.';
COMMENT ON COLUMN public.subscriptions.pending_amount IS
  'The charged amount (in the subscription currency) behind a pending plan change.';
