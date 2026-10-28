-- AI cost capture: a versioned price book and a cost on every settled usage event, computed inside the existing
-- settle function (one lookup on a table of a handful of rows, no extra round trip).
create table if not exists public.ai_price_book (
  id bigint generated always as identity primary key,
  provider text not null,
  model text not null,
  in_usd_per_mtok numeric not null default 0,
  cached_usd_per_mtok numeric not null default 0,
  out_usd_per_mtok numeric not null default 0,
  audio_usd_per_min numeric,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  source_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_price_book_current on public.ai_price_book (model) where effective_to is null;
alter table public.ai_price_book enable row level security;

create table if not exists public.fx_rates (
  day date not null,
  currency text not null,
  per_usd numeric not null,
  primary key (day, currency)
);
alter table public.fx_rates enable row level security;

alter table public.ai_usage_events add column if not exists cost_usd_micro bigint;

insert into public.ai_price_book (provider, model, in_usd_per_mtok, cached_usd_per_mtok, out_usd_per_mtok, source_note) values
  ('google', 'gemini-2.5-flash', 0.30, 0.03, 2.50, 'Seeded from the public list price; confirm on the provider page and edit in the portal.'),
  ('google', 'gemini-2.5-flash-lite', 0.10, 0.01, 0.40, 'Seeded from the public list price; confirm on the provider page and edit in the portal.')
on conflict do nothing;
insert into public.ai_price_book (provider, model, audio_usd_per_min, source_note) values
  ('groq', 'whisper-large-v3', 0.00185, 'Seeded from the public list price ($0.111 per hour); audio seconds are not metered yet, so cost stays 0.')
on conflict do nothing;

-- Provider token counts include cached tokens, so uncached input = in - cached.
create or replace function public.ai_cost_usd_micro(p_model text, p_in integer, p_cached integer, p_out integer)
returns bigint language sql stable set search_path to 'public' as $$
  select coalesce(round((
    greatest(p_in - p_cached, 0) * b.in_usd_per_mtok + p_cached * b.cached_usd_per_mtok + p_out * b.out_usd_per_mtok
  ))::bigint, 0)
  from (select 1) x left join public.ai_price_book b on b.model = p_model and b.effective_to is null
$$;

update public.ai_usage_events set cost_usd_micro = public.ai_cost_usd_micro(model, in_tokens, cached_tokens, out_tokens) where cost_usd_micro is null;

create or replace function public.ai_quota_settle(p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare r public.ai_reservations%rowtype;
begin
  select * into r from public.ai_reservations
    where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return; end if;
  update public.ai_reservations set settled = true where id = p_reservation;
  insert into public.ai_usage_events
    (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro)
  values
    (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, p_units, p_latency, p_status,
     public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out));
  if r.chat_id is not null then
    update public.ai_chats
      set units = units + p_units,
          turns = turns + case when r.feature = 'chat' then 1 else 0 end,
          last_at = now()
      where chat_id = r.chat_id;
  end if;
end;
$function$;
