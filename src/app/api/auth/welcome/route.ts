import { NextResponse } from 'next/server'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendTemplatedEmail } from '@/lib/server/email/send'

/** Only brand-new accounts are welcomed; anyone older is left alone even if the flag were somehow empty. */
const NEW_ACCOUNT_MS = 72 * 3600 * 1000

/**
 * Sends the welcome email once. The claim is one atomic UPDATE (`welcome_email_sent_at IS NULL`), so two tabs, two
 * devices or a retry can never send it twice; a failed send gives the claim back so the next sign-in tries again.
 */
export async function POST(req: Request) {
  const { user } = await resolveRouteUser(req)
  if (!user?.email) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  if (Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_MS) return NextResponse.json({ sent: false })

  const service = createServiceRoleClient()
  const { data: claimed } = await service
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('welcome_email_sent_at', null)
    .select('id, display_name')
    .maybeSingle()
  if (!claimed) return NextResponse.json({ sent: false })

  const fullName = claimed.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined)
  const result = await sendTemplatedEmail('welcome', { email: user.email, id: user.id, fullName, firstName: fullName?.split(' ')[0] }, {}, { service, source: 'system', idempotencyKey: `welcome:${user.id}` })
  if (!result.ok) {
    const { error } = await service.from('profiles').update({ welcome_email_sent_at: null }).eq('id', user.id)
    if (error) console.error('[auth/welcome] could not give the claim back; this user will not be welcomed again', error.message)
    return NextResponse.json({ sent: false }, { status: 502 })
  }
  return NextResponse.json({ sent: true })
}
