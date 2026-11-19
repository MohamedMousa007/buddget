-- docs/SYSTEM_CASH_PLAN.md phase 1, step 6: one Cash per user.
-- On 2026-11-19 one user had two open, untracked Cash rows. The app keeps the oldest one as that user's Cash
-- (cashAccountId sorts by created_at), d66f5c8c-3d11-5f3f-a3d8-0641812ab65c (8 expenses).
-- The newer row f1e036c3-4b9f-4170-b507-8c73d41248ae was referenced by nothing in any of the 17 foreign keys to
-- payment_methods (checked before this ran), so closing it moves no money. Closed, not deleted: closing is what
-- the app does for an account, and it keeps history intact. Safe to run again.
update public.payment_methods
set closed_at = now(), edited_at = now()
where id = 'f1e036c3-4b9f-4170-b507-8c73d41248ae'
  and type = 'cash'
  and closed_at is null
  and exists (select 1 from public.payment_methods k where k.id = 'd66f5c8c-3d11-5f3f-a3d8-0641812ab65c' and k.closed_at is null);
