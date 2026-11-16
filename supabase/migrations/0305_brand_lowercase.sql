-- The brand is written "buddget" (lowercase b, as in the logo). Stored copy follows: email templates and the update
-- gate's message. Whole-word only, so the X-Buddget-* headers and code names stay as they are.
update public.email_templates set
  subject   = regexp_replace(subject,   '(^|[^[:alnum:]_-])Buddget($|[^[:alnum:]_-])', '\1buddget\2', 'g'),
  preheader = regexp_replace(preheader, '(^|[^[:alnum:]_-])Buddget($|[^[:alnum:]_-])', '\1buddget\2', 'g'),
  html      = regexp_replace(html,      '(^|[^[:alnum:]_-])Buddget($|[^[:alnum:]_-])', '\1buddget\2', 'g'),
  blocks    = regexp_replace(blocks::text, '(^|[^[:alnum:]_-])Buddget($|[^[:alnum:]_-])', '\1buddget\2', 'g')::jsonb
where row_to_json(email_templates)::text like '%Buddget%';

do $$
declare d text := pg_get_functiondef('private.app_client_gate()'::regprocedure);
begin
  execute replace(d, 'Update the Buddget app', 'Update the buddget app');
end $$;
