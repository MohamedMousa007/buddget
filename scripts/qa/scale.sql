-- Synthetic scale data: 50k users, 1.5M events, 400k expenses, 300k SMS. QA-only; run against the local `qa` database.
create index if not exists app_analytics_events_user_id_created_at_idx on app_analytics_events (user_id, created_at);
create index if not exists idx_expenses_user on expenses (user_id);
create index if not exists sms_parse_log_user_received_idx on sms_parse_log (user_id, received_at desc);
create index if not exists idx_sms_parse_log_status on sms_parse_log (status);
create index if not exists push_tokens_user_idx on push_tokens (user_id);
truncate auth.users, profiles, user_settings, app_analytics_events, expenses, sms_parse_log, push_tokens, support_tickets cascade;
insert into auth.users (id, email, created_at, email_confirmed_at, last_sign_in_at)
  select gen_random_uuid(), 'user' || g || '@example.com', now() - (random() * interval '400 days'), now(), now() from generate_series(1, 50000) g;
insert into profiles (id, name, email) select id, 'User ' || row_number() over (), email from auth.users;
insert into user_settings (user_id, sms_tracking_enabled) select id, random() < 0.3 from auth.users;
insert into app_analytics_events (user_id, event_type, created_at)
  select u.id, (array['heartbeat','session_start','visibility_visible'])[1 + floor(random()*3)::int], now() - (random() * interval '120 days')
  from (select id from auth.users order by random() limit 30000) u, generate_series(1, 50);
insert into expenses (user_id, amount, created_at) select u.id, 10, now() - (random() * interval '200 days') from auth.users u, generate_series(1, 8);
insert into sms_parse_log (user_id, source, raw_body, status, parsed_ok, sender, failure_code, received_at)
  select u.id, 'x', 'sms body', (array['confirmed','failed','rejected','logged'])[1 + floor(random()*4)::int], random() < 0.7,
         (array['CIB','NBE','QNB','ADCB'])[1 + floor(random()*4)::int], case when random() < 0.1 then 'null_amount' end, now() - (random() * interval '60 days')
  from (select id from auth.users order by random() limit 15000) u, generate_series(1, 20);
insert into push_tokens (user_id, token, platform) select id, gen_random_uuid()::text, (array['ios','android'])[1 + floor(random()*2)::int] from auth.users where random() < 0.6;
insert into support_tickets (user_id, subject, status, priority) select id, 'Ticket for ' || email, (array['open','pending','resolved'])[1 + floor(random()*3)::int], 'normal' from auth.users where random() < 0.1;
analyze;
