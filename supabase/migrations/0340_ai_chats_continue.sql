-- BDG-013 (owner ruling 2026-11-20): Buddgy chats work like ChatGPT and Claude. A chat the user reopens, even days later,
-- continues; it is not split after 30 idle minutes. The idle split lives in ai_idle_minutes (default 30 in
-- ai_default_limits); every plan now sets it to 30 days. A chat still rolls at its turn or spend cap, carrying the recap.
-- Installed builds reset the chat on the phone after 30 minutes and send no chat id, so nothing changes for them.
-- Data only: no function, grant or schema change. Rollback: remove the key from each plan's limits.
update public.plans set limits = coalesce(limits, '{}'::jsonb) || '{"ai_idle_minutes": 43200}'::jsonb;
