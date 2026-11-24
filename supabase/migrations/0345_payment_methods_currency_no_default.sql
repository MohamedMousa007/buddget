-- QA bug 15 (docs/plans/qa-night/A-accounts-misc.md): payment_methods.currency defaulted to 'AED', so any insert that
-- forgot the field would silently create an account in dirhams. Every writer sets it explicitly (the client mapper, the
-- server provisional insert, migration 0329, the e2e seed) and no database function inserts into this table, so the
-- default is dropped: an insert without a currency now fails loudly (NOT NULL) instead of guessing. Safe to run again.
alter table public.payment_methods alter column currency drop default;
