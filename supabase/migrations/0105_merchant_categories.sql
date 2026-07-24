-- 0105 — global merchant→category learning cache.
--
-- The curated/template parse tiers extract a merchant but no category, so every purchase they
-- match lands as 'Other'. This table is the shared memory that fixes that: once ANY user's AI
-- (or a user's own correction) categorises a merchant, every user's future SMS from that
-- merchant is categorised instantly and for free — the same "learn once, reach all" philosophy
-- as the template funnel.
--
-- Global on purpose: "Talabat → Food" is a fact about the merchant, not about a user. Keyed by a
-- lowercased alphanumeric fold of the merchant name so "TALABAT", "Talabat*123" and "talabat"
-- collapse to one row.
create table if not exists merchant_categories (
  merchant_key    text primary key,
  category        expense_category not null,
  source          text not null default 'ai',   -- 'ai' | 'user' | 'seed'
  sample_merchant text,                          -- last raw merchant seen, for admin/debug
  hit_count       int not null default 0,
  updated_at      timestamptz not null default now()
);

alter table merchant_categories enable row level security;

-- Readable by everyone (it is global, non-PII knowledge); writes are service-role only, plus the
-- SECURITY DEFINER trigger below. No user INSERT/UPDATE policy, matching the sms_parse_log
-- precedent.
drop policy if exists merchant_categories_read on merchant_categories;
create policy merchant_categories_read on merchant_categories for select using (true);

-- User category edits are the strongest signal. When a user re-categorises an SMS-sourced
-- expense, remember it globally at source='user' (which outranks 'ai'/'seed' on upsert). Fires
-- only for user-originated writes (auth.uid() is not null) — service-role dispatch writes are
-- excluded, exactly like the template-signal trigger, so the pipeline never teaches itself.
create or replace function remember_merchant_category_on_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  key text;
begin
  if auth.uid() is null then return new; end if;                 -- dispatch/service writes: skip
  if new.sms_log_id is null then return new; end if;             -- only SMS-sourced rows
  if new.category is not distinct from old.category then return new; end if;
  if new.category = 'Other' then return new; end if;             -- clearing to Other teaches nothing
  key := regexp_replace(lower(coalesce(new.description, '')), '[^a-z0-9]', '', 'g');
  if length(key) < 3 then return new; end if;
  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (key, new.category, 'user', new.description, 1, now())
  on conflict (merchant_key) do update
    set category = excluded.category, source = 'user',
        sample_merchant = excluded.sample_merchant,
        hit_count = merchant_categories.hit_count + 1, updated_at = now();
  return new;
end $$;

drop trigger if exists trg_remember_merchant_category on expenses;
create trigger trg_remember_merchant_category
  after update of category on expenses
  for each row execute function remember_merchant_category_on_edit();
