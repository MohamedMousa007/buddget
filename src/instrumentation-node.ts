import { createServiceRoleClient } from '@/lib/supabase/service'
import { ensureSeeded } from '@/lib/server/email/catalog'
import { harvestLegacySms } from '@/lib/sms/harvest'
import { cronConfigWarning } from '@/lib/server/cronHealth'

/** Server start (Node runtime only): built-in emails exist in both languages; older SMS text is harvested into the corpus. */
export function onServerStart() {
  const cronWarning = cronConfigWarning(process.env)
  if (cronWarning) console.error(cronWarning)
  if (!process.env.SUPABASE_SECRET_KEY) return
  const service = createServiceRoleClient()
  void ensureSeeded(service).catch((e) => console.error('[instrumentation] email seed failed', e instanceof Error ? e.message : e))
  void harvestLegacySms(service, 500).catch((e) => console.error('[instrumentation] sms harvest failed', e instanceof Error ? e.message : e))
}
