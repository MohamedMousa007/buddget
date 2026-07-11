-- 0081: Fix "Database error saving new user" on signup / OAuth first login.
--
-- The onboarding flow was removed and its `onboarding_state` table dropped, but
-- `handle_new_user` still inserted into it. Every new-user creation therefore
-- aborted, breaking email signup AND provider (OAuth) first login. Existing
-- sign-in was unaffected because it never creates a user row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
