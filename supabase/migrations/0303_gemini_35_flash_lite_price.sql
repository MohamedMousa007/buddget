-- The fast tier moves to gemini-3.5-flash-lite (gemini-2.5-flash-lite answers 404 to this project). Credits are charged
-- from this price book, so the new model needs a row or its calls cost nothing. Google list price 2026-11-16, per 1M tokens.
insert into public.ai_price_book (provider, model, in_usd_per_mtok, cached_usd_per_mtok, out_usd_per_mtok, source_note) values
  ('google', 'gemini-3.5-flash-lite', 0.30, 0.03, 2.50, 'Google list price read 2026-11-16 (standard tier, output includes thinking).')
on conflict do nothing;
