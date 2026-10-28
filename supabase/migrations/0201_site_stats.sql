-- Cookieless website measurement: one counter row per day, page, language, event and referrer host.
-- No IP, no user agent, no identifiers. Written only through site_stat_bump by the service role.
CREATE TABLE IF NOT EXISTS public.site_stats (
  day date NOT NULL,
  path text NOT NULL CHECK (char_length(path) <= 200),
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  event text NOT NULL CHECK (event IN ('view', 'cta_click', 'lead_submit')),
  ref text NOT NULL DEFAULT '' CHECK (char_length(ref) <= 100),
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, locale, event, ref)
);

ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.site_stat_bump(p_path text, p_locale text, p_event text, p_ref text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.site_stats (day, path, locale, event, ref, n)
  VALUES ((now() AT TIME ZONE 'UTC')::date, p_path, p_locale, p_event, p_ref, 1)
  ON CONFLICT (day, path, locale, event, ref) DO UPDATE SET n = public.site_stats.n + 1;
$$;

REVOKE ALL ON FUNCTION public.site_stat_bump(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_stat_bump(text, text, text, text) TO service_role;
