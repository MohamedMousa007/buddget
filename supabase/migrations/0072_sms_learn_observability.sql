-- Persistent observability for the AI template-learning step.
--
-- learnPattern() previously failed silently (every branch console.warn'd and
-- returned), so we could never tell WHY a high-confidence AI parse produced no
-- learned template — which is why the team keeps falling back to curated
-- patterns instead of trusting the learner. These columns record the outcome of
-- the learning attempt on the parse-log row so it's visible in the admin panel.
--
-- learn_status values:
--   null               — not an AI parse (curated/template), or pre-AI reject
--   'skipped_not_tx'    — parser said not a transaction
--   'skipped_no_key'    — no hotline/sender/bank → no template key
--   'skipped_low_conf'  — confidence < 0.9 learn threshold
--   'pending'           — learning scheduled (after() not finished yet)
--   'cap_reached'       — sender already has 10 templates
--   'gemini_error'      — regex-generation Gemini call failed
--   'no_json'           — Gemini returned no parseable JSON
--   'no_regex_or_amount'— missing regex_pattern or amount rule
--   'regex_no_match'    — generated regex did not match the source SMS
--   'insert_failed'     — template insert errored (non-duplicate)
--   'duplicate'         — template already existed (user recorded in junction)
--   'learned'           — new template inserted
--   'exception'         — unhandled error in learnPattern
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS learn_status TEXT,
  ADD COLUMN IF NOT EXISTS learn_template_id UUID;
