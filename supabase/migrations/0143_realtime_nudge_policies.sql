-- Private per-user broadcast channel ("user:<id>") used to nudge a device that something changed (a new SMS, an edit
-- on another device). Postgres Changes on sms_parse_log is replaced by this: no write-log decoding, no per-row checks.
-- Access is decided once, when a client joins: only the owner may read or send on their own topic.
DROP POLICY IF EXISTS "own nudge channel read" ON realtime.messages;
DROP POLICY IF EXISTS "own nudge channel write" ON realtime.messages;
CREATE POLICY "own nudge channel read" ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND (SELECT realtime.topic()) = 'user:' || (SELECT auth.uid())::text);
CREATE POLICY "own nudge channel write" ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (extension = 'broadcast' AND (SELECT realtime.topic()) = 'user:' || (SELECT auth.uid())::text);
