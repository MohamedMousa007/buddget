-- S4 closing batch, ingest tokens phase 2 (phase 1 is 0284). The server looks tokens up by token_hash only and no
-- longer writes the plain value, so the plain column leaves. Counted on 2026-11-15 before the drop: 29 rows, 0 with a
-- null hash; nothing but the column's own default, unique constraint and partial index depended on it.
drop trigger if exists sms_ingest_token_fill_hash on public.sms_ingest_tokens;
drop function if exists public.sms_ingest_token_fill_hash();
alter table public.sms_ingest_tokens drop column if exists token;
alter table public.sms_ingest_tokens alter column token_hash set not null;
