-- D9: indexes for foreign keys that had none, so cascades from auth.users / parent rows and joins do not seq-scan.
CREATE INDEX IF NOT EXISTS app_analytics_daily_user_id_idx ON public.app_analytics_daily (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_events_chat_id_idx ON public.ai_usage_events (chat_id);
CREATE INDEX IF NOT EXISTS ai_reservations_chat_id_idx ON public.ai_reservations (chat_id);
CREATE INDEX IF NOT EXISTS budget_feedback_plan_id_idx ON public.budget_feedback (plan_id);
CREATE INDEX IF NOT EXISTS integration_outbox_ticket_id_idx ON public.integration_outbox (ticket_id);
CREATE INDEX IF NOT EXISTS support_tickets_duplicate_of_idx ON public.support_tickets (duplicate_of);
CREATE INDEX IF NOT EXISTS support_ticket_messages_author_staff_id_idx ON public.support_ticket_messages (author_staff_id);
CREATE INDEX IF NOT EXISTS admin_user_notes_staff_id_idx ON public.admin_user_notes (staff_id);
CREATE INDEX IF NOT EXISTS admin_access_grants_approved_by_idx ON public.admin_access_grants (approved_by);
CREATE INDEX IF NOT EXISTS admin_financial_exclusions_excluded_by_idx ON public.admin_financial_exclusions (excluded_by);
CREATE INDEX IF NOT EXISTS admin_staff_invited_by_idx ON public.admin_staff (invited_by);
CREATE INDEX IF NOT EXISTS feature_flags_updated_by_idx ON public.feature_flags (updated_by);
CREATE INDEX IF NOT EXISTS platform_settings_updated_by_idx ON public.platform_settings (updated_by);
CREATE INDEX IF NOT EXISTS loyalty_ledger_actor_id_idx ON public.loyalty_ledger (actor_id);
CREATE INDEX IF NOT EXISTS user_entitlements_granted_by_idx ON public.user_entitlements (granted_by);

-- Profiles that predate handle_new_user seeding user_settings (live: 4). The trigger already seeds it for new users.
INSERT INTO public.user_settings (user_id)
SELECT p.id FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_settings s WHERE s.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
