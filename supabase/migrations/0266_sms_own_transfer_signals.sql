-- S2 follow-up part 4 (docs/launch/S1-sms-audit.md 6c): own-account transfers decided on several signals. Additive.
-- sms_parse_log gets what was found for each transfer leg, so every call is logged whether or not it was applied:
--   own_transfer_signals / verdict / candidate, and counterparty_hash (per-user salted; the name is never stored).
-- income_events.exclusion also accepts own_transfer.
-- sms_own_transfer_answers: the user's one remembered answer per pair of account tails. Server-written only.
alter table public.sms_parse_log add column if not exists own_transfer_signals text[];
alter table public.sms_parse_log add column if not exists own_transfer_verdict text;
alter table public.sms_parse_log add column if not exists own_transfer_candidate uuid;
alter table public.sms_parse_log add column if not exists counterparty_hash text;
comment on column public.sms_parse_log.own_transfer_signals is 'Signals found for this leg being one side of a transfer between the user''s own accounts: device, reference, name, account, answered, profile.';
comment on column public.sms_parse_log.own_transfer_verdict is 'settle (strong evidence, booked as an own transfer), ask (middle evidence, the user is asked once), none, undone or declined (the user said no).';
comment on column public.sms_parse_log.own_transfer_candidate is 'The other leg the signals were found against.';
comment on column public.sms_parse_log.counterparty_hash is 'Per-user salted hash of the transfer counterparty''s name. Comparable only within one user; the name itself is not stored.';

alter table public.income_events drop constraint if exists income_events_exclusion_check;
alter table public.income_events add constraint income_events_exclusion_check check (exclusion is null or exclusion in ('pass_through', 'own_transfer'));

create table if not exists public.sms_own_transfer_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_a text not null,
  account_b text not null,
  is_own boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, account_a, account_b),
  check (account_a < account_b)
);
comment on table public.sms_own_transfer_answers is 'The user''s one remembered answer per pair of account tails: are transfers between these two both mine? Written only by the server on the user''s explicit answer.';
alter table public.sms_own_transfer_answers enable row level security;
revoke all on public.sms_own_transfer_answers from anon, authenticated;
