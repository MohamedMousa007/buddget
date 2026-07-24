-- One-time cleanup of the existing 'Other' SMS-purchase flood + a starter seed for the shared
-- merchant→category cache. Only confidently-identifiable merchants are mapped; genuinely opaque
-- truncated names (ABRAG ALR, ESTABL, Kashier gateways, …) are deliberately left 'Other' rather
-- than guessed. Streaming/music brands are set to 'Enjoyment' to match what the live subscription
-- catalog resolves them to. source='seed' so a later user correction or AI parse can override.
with seed(name, category) as (
  values
    ('Talabat','Food'), ('Mcdonalds The Gate','Food'), ('Geideae Coffee','Food'),
    ('LA ROSE PASTRY','Food'),
    ('KAZYON','Groceries'), ('BIM6OCT TAHRIR 6TH OCT','Groceries'),
    ('Amazon Prime','Enjoyment'), ('Netflix.com','Enjoyment'), ('OSN+','Enjoyment'),
    ('STARZPLAY.COM','Enjoyment'), ('Spotify','Enjoyment'), ('Kick Streaming','Enjoyment'),
    ('Yango Play','Enjoyment'), ('Scene cinema','Enjoyment'),
    ('APPLE.COM BILL','Subscription'),
    ('Fuel Up October','Fuel'), ('EL Wahat for oi','Fuel'),
    ('WE FV POST','Utilities'), ('Fastel','Utilities'),
    ('Elwahat For Pet','Shopping'),
    ('FawryPF ELBORG','Health')
)
-- 1. Retro-fix the user-visible rows.
, fixed as (
  update expenses e
     set category = s.category::expense_category, updated_at = now()
    from seed s
    join sms_parse_log l on true
   where e.description = s.name
     and e.category = 'Other'
     and e.deleted_at is null
     and e.sms_log_id = l.id
     and l.kind in ('purchase','online_purchase','declined')
  returning 1
)
-- 2. Seed the cache so these merchants are categorised for free next time (for anyone).
insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count)
select regexp_replace(lower(s.name),'[^a-z0-9]','','g'), s.category::expense_category, 'seed', s.name, 1
  from seed s
 where length(regexp_replace(lower(s.name),'[^a-z0-9]','','g')) >= 3
on conflict (merchant_key) do nothing;
