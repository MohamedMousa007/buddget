import { appOrigin } from '@/lib/apiBase'
import { guardAdmin, json } from '@/lib/server/admin/guard'

/** What must be in place before Supabase's own mailer can be retired, and proof the hook is live. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'emails.view' })
  if (!g.ok) return g.res
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [last, day, fails] = await Promise.all([
    g.ctx.service.from('email_log').select('created_at, template_key, status').eq('source', 'auth_hook').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    g.ctx.service.from('email_log').select('id', { count: 'exact', head: true }).eq('source', 'auth_hook').gte('created_at', since),
    g.ctx.service.from('email_log').select('id', { count: 'exact', head: true }).eq('source', 'auth_hook').gte('created_at', since).in('status', ['failed', 'bounced', 'complained']),
  ])
  const set = (n: string) => !!process.env[n]?.trim()
  return json({
    hookUrl: `${appOrigin()}/api/auth/email-hook`,
    webhookUrl: `${appOrigin()}/api/webhooks/resend`,
    checks: {
      resendKey: set('RESEND_API_KEY'),
      emailFrom: set('EMAIL_FROM'),
      hookSecret: set('SEND_EMAIL_HOOK_SECRET'),
      webhookSecret: set('RESEND_WEBHOOK_SECRET'),
      translator: set('GEMINI_API_KEY'),
    },
    hook: { last: last.data, sentLast24h: day.count ?? 0, failedLast24h: fails.count ?? 0 },
  })
}
