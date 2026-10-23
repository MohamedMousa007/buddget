-- PREPARED, NOT APPLIED: awaiting owner approval (see docs/ADMIN_PLATFORM_REVIEW.md, 2.3).
-- Own-row policies that apply to every role, anon included. They already return nothing to anon (auth.uid() is null),
-- so this only narrows who the policy applies to. Reversible with ALTER POLICY ... TO public.
ALTER POLICY "own biometric device delete" ON public.biometric_devices TO authenticated;
ALTER POLICY "own biometric device read" ON public.biometric_devices TO authenticated;
ALTER POLICY push_tokens_select_own ON public.push_tokens TO authenticated;
ALTER POLICY receipts_delete_own ON public.receipts TO authenticated;
ALTER POLICY receipts_insert_own ON public.receipts TO authenticated;
ALTER POLICY receipts_select_own ON public.receipts TO authenticated;
ALTER POLICY receipts_update_own ON public.receipts TO authenticated;
ALTER POLICY sms_ingest_tokens_select_own ON public.sms_ingest_tokens TO authenticated;
ALTER POLICY sms_ingest_tokens_update_own ON public.sms_ingest_tokens TO authenticated;
ALTER POLICY sms_parse_log_select_own ON public.sms_parse_log TO authenticated;
ALTER POLICY "own signals readable" ON public.sms_template_signals TO authenticated;
