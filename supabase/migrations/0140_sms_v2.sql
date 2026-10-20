-- SMS pipeline v2 (scaling plan phases 1 and 3).
--  * Per-SMS statistics (keyword and sender pools, template match counts, sender currency, learning corpus) go to a
--    small UNLOGGED outbox with one insert, and a scheduled drain applies them in batches. Hot rows are written once
--    per batch instead of once per SMS.
--  * The knowledge in raw SMS text is kept as a redacted corpus (sms_corpus) before the text itself is removed at 30 days.
--  * Stuck rows are healed and old text removed by scheduled jobs, not by every request.

ALTER TABLE public.sms_parse_log ADD COLUMN IF NOT EXISTS harvested_at timestamptz;

-- The learning corpus: one row per message skeleton (digits and names masked), with outcome counts. No personal data.
CREATE TABLE IF NOT EXISTS public.sms_corpus (
  skeleton_key text PRIMARY KEY,
  sender_key text,
  redacted_body text NOT NULL,
  kind text,
  parse_method text,
  currency text,
  matched_template_id uuid,
  seen_count integer NOT NULL DEFAULT 1,
  ok_count integer NOT NULL DEFAULT 0,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_corpus_sender_idx ON public.sms_corpus (sender_key, last_seen DESC);
ALTER TABLE public.sms_corpus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_corpus FROM anon, authenticated;

-- Outbox for per-SMS statistics. UNLOGGED: statistics only, a crash loses at most a few minutes of counts.
CREATE UNLOGGED TABLE IF NOT EXISTS public.sms_stats_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  sender text,
  is_txn boolean NOT NULL DEFAULT true,
  kw text[] NOT NULL DEFAULT '{}',
  kw_lang text[] NOT NULL DEFAULT '{}',
  template_id uuid,
  user_id uuid,
  bump_match boolean NOT NULL DEFAULT true,
  ccy_sender text,
  ccy_currency public.currency_code,
  ccy_confirmed boolean,
  skeleton_key text,
  sender_key text,
  redacted_body text,
  kind text,
  parse_method text,
  currency text,
  parsed_ok boolean
);
ALTER TABLE public.sms_stats_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_stats_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sms_stats_drain(p_limit integer DEFAULT 5000) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sms_stats_outbox LIMIT 1) THEN RETURN 0; END IF;
  CREATE TEMP TABLE _b ON COMMIT DROP AS
    WITH d AS (
      DELETE FROM sms_stats_outbox WHERE id IN (SELECT id FROM sms_stats_outbox ORDER BY id LIMIT p_limit FOR UPDATE SKIP LOCKED)
      RETURNING *
    ) SELECT * FROM d;
  SELECT count(*) INTO n FROM _b;

  INSERT INTO sms_sender_pool AS p (sender, hit_count, txn_count)
  SELECT sender, count(*)::int, (count(*) FILTER (WHERE is_txn))::int FROM _b WHERE sender IS NOT NULL GROUP BY sender
  ON CONFLICT (sender) DO UPDATE SET hit_count = p.hit_count + EXCLUDED.hit_count, txn_count = p.txn_count + EXCLUDED.txn_count, last_seen = now();

  INSERT INTO sms_keyword_pool AS k (keyword, lang, hit_count)
  SELECT w, (array_agg(l))[1], count(*)::int
  FROM (SELECT unnest(kw) AS w, unnest(kw_lang) AS l FROM _b) x GROUP BY w
  ON CONFLICT (keyword) DO UPDATE SET hit_count = k.hit_count + EXCLUDED.hit_count, last_seen = now(), lang = COALESCE(k.lang, EXCLUDED.lang);

  UPDATE sms_tracking_templates_ai t SET match_count = t.match_count + x.c, updated_at = now()
  FROM (SELECT template_id, count(*)::int AS c FROM _b WHERE template_id IS NOT NULL AND bump_match GROUP BY template_id) x
  WHERE t.id = x.template_id;

  INSERT INTO sms_template_users (template_id, user_id)
  SELECT DISTINCT template_id, user_id FROM _b WHERE template_id IS NOT NULL AND user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  UPDATE sms_tracking_templates_ai t SET unique_user_count = GREATEST((SELECT count(*) FROM sms_template_users u WHERE u.template_id = t.id), 1)
  WHERE t.id IN (SELECT DISTINCT template_id FROM _b WHERE template_id IS NOT NULL AND user_id IS NOT NULL);

  INSERT INTO sms_sender_currency AS c (user_id, sender, currency, confirmed, hit_count)
  SELECT user_id, ccy_sender, (array_agg(ccy_currency ORDER BY id DESC))[1], bool_or(ccy_confirmed), count(*)::int
  FROM _b WHERE user_id IS NOT NULL AND ccy_sender IS NOT NULL AND ccy_currency IS NOT NULL GROUP BY user_id, ccy_sender
  ON CONFLICT (user_id, sender) DO UPDATE SET
    hit_count = c.hit_count + EXCLUDED.hit_count, updated_at = now(),
    currency = CASE WHEN EXCLUDED.confirmed THEN EXCLUDED.currency WHEN c.confirmed THEN c.currency ELSE EXCLUDED.currency END,
    confirmed = c.confirmed OR EXCLUDED.confirmed;

  INSERT INTO sms_corpus AS c (skeleton_key, sender_key, redacted_body, kind, parse_method, currency, matched_template_id, seen_count, ok_count)
  SELECT skeleton_key, max(sender_key), (array_agg(redacted_body ORDER BY id))[1], (array_agg(kind ORDER BY id DESC))[1],
         (array_agg(parse_method ORDER BY id DESC))[1], (array_agg(currency ORDER BY id DESC))[1],
         (array_agg(template_id ORDER BY id DESC) FILTER (WHERE template_id IS NOT NULL))[1],
         count(*)::int, (count(*) FILTER (WHERE parsed_ok))::int
  FROM _b WHERE skeleton_key IS NOT NULL AND redacted_body IS NOT NULL GROUP BY skeleton_key
  ON CONFLICT (skeleton_key) DO UPDATE SET
    seen_count = c.seen_count + EXCLUDED.seen_count, ok_count = c.ok_count + EXCLUDED.ok_count, last_seen = now(),
    kind = COALESCE(EXCLUDED.kind, c.kind), parse_method = COALESCE(EXCLUDED.parse_method, c.parse_method),
    currency = COALESCE(EXCLUDED.currency, c.currency), matched_template_id = COALESCE(EXCLUDED.matched_template_id, c.matched_template_id);

  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_stats_drain(integer) FROM PUBLIC, anon, authenticated;

-- "Same amount in every message" check, judged on the message fingerprint so it keeps working after raw text is removed.
CREATE OR REPLACE FUNCTION public.detect_zero_variance_templates(p_min_matches integer DEFAULT 4)
RETURNS TABLE(template_id uuid, distinct_bodies integer, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  SELECT l.matched_template_id, count(DISTINCT l.sms_hash)::int, min(l.amount)
    FROM sms_parse_log l JOIN sms_tracking_templates_ai t ON t.id = l.matched_template_id
   WHERE l.matched_template_id IS NOT NULL AND l.amount IS NOT NULL AND l.sms_hash IS NOT NULL
     AND l.received_at > now() - interval '90 days' AND t.status = 'active' AND t.hard_fail = false
   GROUP BY l.matched_template_id
  HAVING count(DISTINCT l.sms_hash) >= p_min_matches AND count(DISTINCT l.amount) = 1;
$$;

-- The check and its consequence in one scheduled call (it used to run inside 1 in 10 SMS requests).
CREATE OR REPLACE FUNCTION public.sms_zero_variance_sweep() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM detect_zero_variance_templates(4) LOOP
    PERFORM bump_sms_template_failure(r.template_id, true, 'zero_variance_amount: ' || r.amount || ' across ' || r.distinct_bodies || ' distinct bodies');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_zero_variance_sweep() FROM PUBLIC, anon, authenticated;

-- Raw text is removed after 30 days, but only once its knowledge has been harvested into sms_corpus.
CREATE OR REPLACE FUNCTION public.sms_retention() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE sms_parse_log SET raw_body = NULL, push_result = NULL
   WHERE received_at < now() - interval '30 days' AND harvested_at IS NOT NULL AND (raw_body IS NOT NULL OR push_result IS NOT NULL)
     AND id IN (SELECT id FROM sms_parse_log WHERE received_at < now() - interval '30 days' AND harvested_at IS NOT NULL AND raw_body IS NOT NULL LIMIT 5000);
  GET DIAGNOSTICS n = ROW_COUNT;
  -- One-off skeletons older than six months have taught nothing; recurring ones stay.
  DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - interval '180 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_retention() FROM PUBLIC, anon, authenticated;

-- Rows left in "processing" by a function that was cut off are failed by a schedule (the received_at filter uses an index).
CREATE OR REPLACE FUNCTION public.sms_heal_stuck() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE sms_parse_log SET status = 'failed', failure_code = 'timed_out'
   WHERE received_at > now() - interval '2 days' AND status = 'processing' AND parsed_at < now() - interval '2 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_heal_stuck() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('sms-stats-drain', '*/5 * * * *', $$SELECT public.sms_stats_drain()$$);
SELECT cron.schedule('sms-heal-stuck', '*/5 * * * *', $$SELECT public.sms_heal_stuck()$$);
SELECT cron.schedule('sms-zero-variance', '17 * * * *', $$SELECT public.sms_zero_variance_sweep()$$);
SELECT cron.schedule('sms-retention', '50 0 * * *', $$SELECT public.sms_retention()$$);
