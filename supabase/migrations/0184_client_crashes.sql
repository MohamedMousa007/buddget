-- App crashes and errors, fed by the Sentry webhook. Service role only, like every admin table.
-- Stacks are scrubbed on the device before they leave it (src/lib/crash/scrub.ts); this table never holds SMS text or amounts.
CREATE TABLE IF NOT EXISTS public.client_crashes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint     text NOT NULL,
  release         text NOT NULL DEFAULT '',
  sentry_issue_id text,
  sentry_url      text,
  level           text NOT NULL DEFAULT 'error' CHECK (level IN ('fatal','error','warning','info')),
  title           text NOT NULL,
  culprit         text,
  stack           text,
  platform        text,
  build           text,
  device_id       text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurrences     integer NOT NULL DEFAULT 1,
  first_seen      timestamptz NOT NULL DEFAULT now(),
  last_seen       timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','resolved')),
  UNIQUE (fingerprint, release)
);
CREATE INDEX IF NOT EXISTS client_crashes_last_seen_idx ON public.client_crashes (last_seen DESC);
CREATE INDEX IF NOT EXISTS client_crashes_user_idx ON public.client_crashes (user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.client_crashes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_crashes FROM anon, authenticated;

-- A new crash, or one more of an old one. One round trip, so two webhook deliveries cannot both insert.
CREATE OR REPLACE FUNCTION public.record_client_crash(
  p_fingerprint text, p_release text, p_title text, p_level text, p_culprit text, p_stack text, p_platform text,
  p_build text, p_device_id text, p_user_id uuid, p_sentry_issue_id text, p_sentry_url text, p_seen timestamptz
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO client_crashes AS c (fingerprint, release, title, level, culprit, stack, platform, build, device_id, user_id, sentry_issue_id, sentry_url, first_seen, last_seen)
  VALUES (p_fingerprint, COALESCE(p_release, ''), p_title, p_level, p_culprit, p_stack, p_platform, p_build, p_device_id, p_user_id, p_sentry_issue_id, p_sentry_url, p_seen, p_seen)
  ON CONFLICT (fingerprint, release) DO UPDATE SET
    occurrences = c.occurrences + 1,
    last_seen = GREATEST(c.last_seen, EXCLUDED.last_seen),
    status = CASE WHEN c.status = 'resolved' THEN 'new' ELSE c.status END,
    device_id = COALESCE(EXCLUDED.device_id, c.device_id),
    user_id = COALESCE(EXCLUDED.user_id, c.user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.record_client_crash(text, text, text, text, text, text, text, text, text, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_crash(text, text, text, text, text, text, text, text, text, uuid, text, text, timestamptz) TO service_role;

UPDATE public.admin_roles SET permissions = permissions || ARRAY['crashes.view','crashes.manage']
WHERE key IN ('admin','engineer','data_ai') AND NOT ('crashes.view' = ANY (permissions));

DO $$ BEGIN
  PERFORM cron.schedule('crash_retention', '40 1 * * *', $c$DELETE FROM public.client_crashes WHERE last_seen < now() - interval '120 days'$c$);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
