-- Audit first (read-only), expect a handful of rows:
--   SELECT status, count(*) FROM public.client_crashes GROUP BY 1;
--   SELECT count(*) FROM public.client_crashes WHERE status = 'resolved';
-- Additive only: record_client_crash stays untouched for old callers. New: record_client_crash_v2.
-- A resolved crash reopens only when it reappears in a newer build than the one resolved in, or more than 24h after
-- the resolve (legacy rows without a stamp fall back to last_seen). Replays of one event id never count twice.

ALTER TABLE public.client_crashes
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_build text;

CREATE TABLE IF NOT EXISTS public.client_crash_events (
  crash_id uuid NOT NULL REFERENCES public.client_crashes(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  PRIMARY KEY (crash_id, event_id)
);
ALTER TABLE public.client_crash_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_crash_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_crash_stamp_resolved() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
    NEW.resolved_build := NEW.build;
  ELSIF NEW.status <> 'resolved' AND OLD.status = 'resolved' THEN
    NEW.resolved_at := NULL;
    NEW.resolved_build := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS client_crashes_stamp_resolved ON public.client_crashes;
CREATE TRIGGER client_crashes_stamp_resolved BEFORE UPDATE OF status ON public.client_crashes
  FOR EACH ROW EXECUTE FUNCTION public.client_crash_stamp_resolved();

CREATE OR REPLACE FUNCTION public.record_client_crash_v2(
  p_fingerprint text, p_release text, p_title text, p_level text, p_culprit text, p_stack text, p_platform text,
  p_build text, p_device_id text, p_user_id uuid, p_sentry_issue_id text, p_sentry_url text, p_seen timestamptz,
  p_event_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_build_n bigint;
  v_row_build_n bigint;
  v_resolved_build_n bigint;
  v_resolved_at timestamptz;
  v_last_seen timestamptz;
  v_reopen boolean;
BEGIN
  INSERT INTO client_crashes (fingerprint, release, title, level, culprit, stack, platform, build, device_id, user_id, sentry_issue_id, sentry_url, first_seen, last_seen)
  VALUES (p_fingerprint, COALESCE(p_release, ''), p_title, p_level, p_culprit, p_stack, p_platform, p_build, p_device_id, p_user_id, p_sentry_issue_id, p_sentry_url, p_seen, p_seen)
  ON CONFLICT (fingerprint, release) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    IF p_event_id IS NOT NULL THEN
      INSERT INTO client_crash_events (crash_id, event_id) VALUES (v_id, p_event_id) ON CONFLICT DO NOTHING;
    END IF;
    RETURN;
  END IF;

  SELECT id, status, resolved_at, last_seen,
         NULLIF(regexp_replace(COALESCE(build, ''), '\D', '', 'g'), '')::bigint,
         NULLIF(regexp_replace(COALESCE(resolved_build, ''), '\D', '', 'g'), '')::bigint
    INTO v_id, v_status, v_resolved_at, v_last_seen, v_row_build_n, v_resolved_build_n
    FROM client_crashes WHERE fingerprint = p_fingerprint AND release = COALESCE(p_release, '') FOR UPDATE;
  IF v_id IS NULL THEN RETURN; END IF;

  IF p_event_id IS NOT NULL THEN
    INSERT INTO client_crash_events (crash_id, event_id) VALUES (v_id, p_event_id) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN; END IF;
  END IF;

  v_build_n := NULLIF(regexp_replace(COALESCE(p_build, ''), '\D', '', 'g'), '')::bigint;
  v_reopen := v_status = 'resolved' AND (
    (v_build_n IS NOT NULL AND v_build_n > COALESCE(v_resolved_build_n, v_row_build_n, 0))
    OR p_seen > COALESCE(v_resolved_at, v_last_seen) + interval '24 hours'
  );

  UPDATE client_crashes SET
    occurrences = occurrences + 1,
    last_seen = GREATEST(last_seen, p_seen),
    status = CASE WHEN v_reopen THEN 'new' ELSE status END,
    build = CASE WHEN v_build_n IS NOT NULL AND v_build_n > COALESCE(v_row_build_n, 0) THEN p_build ELSE build END,
    device_id = COALESCE(p_device_id, device_id),
    user_id = COALESCE(p_user_id, user_id)
  WHERE id = v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_client_crash_v2(text, text, text, text, text, text, text, text, text, uuid, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_crash_v2(text, text, text, text, text, text, text, text, text, uuid, text, text, timestamptz, text) TO service_role;

-- Assertions (rows removed afterwards).
DO $$
DECLARE r public.client_crashes; n int;
BEGIN
  PERFORM record_client_crash_v2('__t0223', 'rel', 't', 'error', null, null, 'ios', '10', null, null, null, null, now(), 'e1');
  PERFORM record_client_crash_v2('__t0223', 'rel', 't', 'error', null, null, 'ios', '10', null, null, null, null, now(), 'e1');
  SELECT * INTO r FROM client_crashes WHERE fingerprint = '__t0223';
  IF r.occurrences <> 1 THEN RAISE EXCEPTION 'replay incremented occurrences'; END IF;
  UPDATE client_crashes SET status = 'resolved' WHERE id = r.id;
  PERFORM record_client_crash_v2('__t0223', 'rel', 't', 'error', null, null, 'ios', '10', null, null, null, null, now(), 'e2');
  SELECT * INTO r FROM client_crashes WHERE fingerprint = '__t0223';
  IF r.status <> 'resolved' OR r.occurrences <> 2 THEN RAISE EXCEPTION 'same-build recurrence reopened or not counted'; END IF;
  PERFORM record_client_crash_v2('__t0223', 'rel', 't', 'error', null, null, 'ios', '11', null, null, null, null, now(), 'e3');
  SELECT * INTO r FROM client_crashes WHERE fingerprint = '__t0223';
  IF r.status <> 'new' THEN RAISE EXCEPTION 'newer build did not reopen'; END IF;
  DELETE FROM client_crashes WHERE fingerprint = '__t0223';
  SELECT count(*) INTO n FROM client_crash_events;
END $$;
