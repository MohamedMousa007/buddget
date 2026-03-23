-- Align published onboarding copy: income is captured during signup, not deferred to “later in the app”.
-- Safe to run multiple times; only rewrites matching step ids / known old strings.

update public.onboarding_survey_config o
set config = jsonb_set(
  o.config,
  '{steps}',
  coalesce(
    (
      select jsonb_agg(s.new_step order by s.ord)
      from (
        select
          t.ord,
          case
            when t.step->>'id' = 'income_quick' then
              jsonb_set(
                t.step,
                '{body}',
                to_jsonb(
                  'Your income is set during this signup. Continue to enter your typical monthly amount, or indicate no regular income.'::text
                )
              )
            when t.step->>'id' = 'done' then
              jsonb_set(
                t.step,
                '{body}',
                to_jsonb(
                  'We’ll open your dashboard. Primary income was set during signup; adjust budgets anytime. You can import a backup from Settings.'::text
                )
              )
            when t.step->>'id' = 'income_choice' and jsonb_typeof(t.step->'options') = 'array' then
              jsonb_set(
                t.step,
                '{options}',
                (
                  select jsonb_agg(
                    case
                      when opt->>'value' = 'no_income' then
                        jsonb_set(opt, '{label}', to_jsonb('No regular income at the moment'::text))
                      when opt->>'value' = 'has_income' then
                        jsonb_set(
                          opt,
                          '{label}',
                          to_jsonb('I have regular income — I’ll enter it in the next step (during signup)'::text)
                        )
                      else opt
                    end
                  )
                  from jsonb_array_elements(t.step->'options') as opt
                )
              )
            else t.step
          end as new_step
        from jsonb_array_elements(o.config->'steps') with ordinality as t(step, ord)
      ) s
    ),
    o.config->'steps'
  )
)
where o.published = true
  and jsonb_typeof(o.config->'steps') = 'array';
