-- S2 council decision (2026-11-14): the AI's category for a purchase nobody knows is still applied, but as a visible
-- suggestion. Additive.
-- category_source: ai_suggested = the AI's guess (shown with a badge, never used as evidence for other rows);
--   user_confirmed / user_changed = what the user did with a suggestion, which is the measured accuracy of the guesses;
--   null = set by a rule, the dictionary, history or the user directly.
alter table public.expenses add column if not exists category_source text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_category_source_check') then
    alter table public.expenses add constraint expenses_category_source_check check (category_source is null or category_source in ('ai_suggested','user_confirmed','user_changed'));
  end if;
end $$;
comment on column public.expenses.category_source is 'ai_suggested = the category is the AI''s guess, shown as a suggestion and never used as evidence; user_confirmed / user_changed = what the user did with a suggestion. Null = set by a rule, the dictionary, history or the user directly.';
