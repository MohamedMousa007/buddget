-- Support as a conversation: who spoke last and when (list order, unread, "needs reply"), each side's read
-- position, a one-time satisfaction rating, and screenshot attachments in a private bucket.

ALTER TABLE public.support_tickets
  ADD COLUMN last_message_at      timestamptz,
  ADD COLUMN last_message_from    text CHECK (last_message_from IN ('user', 'staff')),
  ADD COLUMN last_message_preview text,
  ADD COLUMN user_last_read_at    timestamptz,
  ADD COLUMN staff_last_read_at   timestamptz,
  ADD COLUMN csat_rating          smallint CHECK (csat_rating IN (-1, 1)),
  ADD COLUMN csat_comment         text CHECK (char_length(csat_comment) <= 500),
  ADD COLUMN csat_at              timestamptz;

-- Up to four images per message: [{ path, mime, size }]. Paths live in the private support-attachments bucket.
ALTER TABLE public.support_ticket_messages
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 4);

-- Every public message (from support_submit, the user route or the portal) moves the ticket's "last message".
CREATE OR REPLACE FUNCTION public.support_message_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal OR NEW.author_type NOT IN ('user', 'staff') THEN
    RETURN NEW;
  END IF;
  UPDATE public.support_tickets
     SET last_message_at = NEW.created_at,
         last_message_from = NEW.author_type,
         last_message_preview = left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 140)
   WHERE id = NEW.ticket_id
     AND (last_message_at IS NULL OR last_message_at <= NEW.created_at);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.support_message_bump() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS support_message_bump ON public.support_ticket_messages;
CREATE TRIGGER support_message_bump AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_message_bump();

-- Backfill from the existing threads; existing tickets start read on both sides.
UPDATE public.support_tickets t
   SET last_message_at = m.created_at,
       last_message_from = m.author_type,
       last_message_preview = left(regexp_replace(m.body, '\s+', ' ', 'g'), 140)
  FROM (
    SELECT DISTINCT ON (ticket_id) ticket_id, created_at, author_type, body
      FROM public.support_ticket_messages
     WHERE NOT internal AND author_type IN ('user', 'staff')
     ORDER BY ticket_id, created_at DESC
  ) m
 WHERE m.ticket_id = t.id;
UPDATE public.support_tickets
   SET user_last_read_at = coalesce(last_message_at, created_at),
       staff_last_read_at = coalesce(last_message_at, created_at)
 WHERE user_last_read_at IS NULL;

-- The user's list (own tickets, latest conversation first) replaces the plain user_id index, which it covers.
CREATE INDEX IF NOT EXISTS support_tickets_user_recent_idx ON public.support_tickets (user_id, last_message_at DESC NULLS LAST);
DROP INDEX IF EXISTS public.support_tickets_user_idx;
-- The portal's default view: open conversations where the user spoke last, longest waiting first.
CREATE INDEX IF NOT EXISTS support_tickets_needs_reply_idx ON public.support_tickets (last_message_at)
  WHERE status IN ('open', 'pending') AND last_message_from = 'user';

-- Private bucket: no storage policies, so only the service role (our routes) can read or write. The bucket itself
-- enforces the size and type limits on every upload.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('support-attachments', 'support-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;
