-- Pro, Rewards, Founders and Invites, spec section 0: the owner-approved live writes (test data; reset at launch).
-- Billing on; every existing account on Free, a founder (numbered by sign-up date), a member number, a loyalty account and an
-- invite code; the founder window open so the Founders page works. One batch (48 accounts) under a short statement timeout.
--
-- AUDIT SELECT (live, 2026-11-17, before applying):
--   auth.users 48 | user_entitlements 47 (all plus / active / promo) | loyalty_accounts 0 | founders 0 | member_numbers 0
--   referral_codes 0 | loyalty_program 0 | beta_testers among users 43 | platform_settings.billing = {"enabled": false}

set local statement_timeout = '60s';

update public.platform_settings set value = coalesce(value, '{}'::jsonb) || '{"enabled": true}'::jsonb, updated_at = now() where key = 'billing';

-- Free, with no trial side effects (no trial row, no trial claim used; source default so each can still claim a trial later).
update public.user_entitlements
  set plan_key = 'free', status = 'active', source = 'default', trial_ends_at = null, current_period_end = null, canceled_at = null,
      will_renew = null, grace_ends_at = null, note = 'Launch test reset: Free', updated_at = now()
  where plan_key <> 'free';

insert into public.loyalty_accounts (user_id) select id from auth.users on conflict (user_id) do nothing;

insert into public.member_numbers (user_id, number, created_at)
select id, row_number() over (order by created_at, id), created_at from auth.users
on conflict (user_id) do nothing;
select setval('public.member_number_seq', greatest((select coalesce(max(number), 0) from public.member_numbers), 1));

insert into public.loyalty_program (id, founder_window_opens, founder_window_closes, founder_cap)
values (true, now(), '2027-06-30 23:59:59+00', 100)
on conflict (id) do update set founder_window_opens = excluded.founder_window_opens, founder_window_closes = excluded.founder_window_closes, founder_cap = excluded.founder_cap;

insert into public.founders (number, user_id, cohort, qualified_at)
select row_number() over (order by u.created_at, u.id), u.id,
       case when exists (select 1 from public.beta_testers b where b.user_id = u.id) then 'beta' else 'public' end, u.created_at
from auth.users u
where not exists (select 1 from public.founders f where f.user_id = u.id)
on conflict do nothing;
insert into public.loyalty_events (user_id, kind, period_key)
select user_id, 'founder_granted', number::text from public.founders where user_id is not null on conflict do nothing;

select count(public.referral_ensure_code(id)) from auth.users;
