-- 0103 — add the 'Instapay' spend category.
--
-- Egyptian instant person-to-person transfers run over InstaPay (the IPN network) and are the
-- overwhelmingly common form of "money sent" in Egypt. They deserve their own, instantly
-- recognisable category rather than the vaguer 'Remittance', which is kept for non-IPN and
-- international sends.
--
-- ADD VALUE must run in its own migration: Postgres forbids using a newly-added enum value in
-- the same transaction that created it, so the backfill lives in 0104.
alter type expense_category add value if not exists 'Instapay';
