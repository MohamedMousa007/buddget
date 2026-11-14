-- Curated templates are tried only when their `sender` is one of the message's lookup keys
-- (curatedTemplateInScope). These three were learned on sender-less messages and stored under a
-- bank-name key, which a sender-less iPhone message never produces, so they never ran. Re-key each
-- to the BODY-<hash> that bodyShapeKey() yields for every message it matched (all matched messages
-- share one key; no existing row holds these keys or the same regex under them).
-- Idempotent: each update is guarded by the old sender, so a re-run changes nothing.
update public.sms_tracking_templates_ai set sender = 'BODY-11583741'
  where id = '7a683e81-713a-4717-88d4-8978b9a54662' and sender = 'BARQ' and tier = 'curated_db';
update public.sms_tracking_templates_ai set sender = 'BODY-9bd938f4'
  where id = '89bd88f3-8aa9-4f52-b4c2-b6e2430ade79' and sender = 'QNB EGYPT' and tier = 'curated_db';
update public.sms_tracking_templates_ai set sender = 'BODY-eee81a53'
  where id = '6eeaff91-6163-4f3a-b75b-3d77913edc95' and sender = 'VF-CASH' and tier = 'curated_db';
