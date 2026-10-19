/** Runs once when a server instance starts. Makes sure every built-in email exists (English and Arabic) in the database. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SUPABASE_SECRET_KEY) return
  const [{ createServiceRoleClient }, { ensureSeeded }] = await Promise.all([
    import('@/lib/supabase/service'),
    import('@/lib/server/email/catalog'),
  ])
  void ensureSeeded(createServiceRoleClient()).catch((e) => console.error('[instrumentation] email seed failed', e instanceof Error ? e.message : e))
}
