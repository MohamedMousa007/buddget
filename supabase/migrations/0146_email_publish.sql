-- Publishing an email replaces the live row and promotes the draft in ONE transaction, so there is never a moment with
-- no published template (the app code did this in three separate calls).
CREATE OR REPLACE FUNCTION public.publish_email_template(p_key text, p_locale text, p_staff uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d email_templates%ROWTYPE;
BEGIN
  SELECT * INTO d FROM email_templates WHERE key = p_key AND locale = p_locale AND status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO email_template_versions (key, locale, version, subject, preheader, html, mode, blocks, published_by)
  VALUES (d.key, d.locale, d.version, d.subject, d.preheader, d.html, d.mode, d.blocks, p_staff)
  ON CONFLICT (key, locale, version) DO UPDATE SET subject = EXCLUDED.subject, preheader = EXCLUDED.preheader, html = EXCLUDED.html,
    mode = EXCLUDED.mode, blocks = EXCLUDED.blocks, published_by = EXCLUDED.published_by, published_at = now();
  DELETE FROM email_templates WHERE key = p_key AND locale = p_locale AND status = 'published';
  UPDATE email_templates SET status = 'published', updated_by = p_staff, updated_at = now() WHERE id = d.id;
  RETURN d.version;
END $$;
REVOKE ALL ON FUNCTION public.publish_email_template(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_email_template(text, text, uuid) TO service_role;
