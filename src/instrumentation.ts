/**
 * Runs once when a server instance starts: makes sure every built-in email exists (English and Arabic), and
 * harvests what older SMS text teaches into the redacted corpus (batched, safe to repeat).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SUPABASE_SECRET_KEY) return
  const [{ createServiceRoleClient }, { ensureSeeded }, { harvestLegacySms }] = await Promise.all([
    import('@/lib/supabase/service'),
    import('@/lib/server/email/catalog'),
    import('@/lib/sms/harvest'),
  ])
  const service = createServiceRoleClient()
  void ensureSeeded(service).catch((e) => console.error('[instrumentation] email seed failed', e instanceof Error ? e.message : e))
  void harvestLegacySms(service, 500).catch((e) => console.error('[instrumentation] sms harvest failed', e instanceof Error ? e.message : e))
}
