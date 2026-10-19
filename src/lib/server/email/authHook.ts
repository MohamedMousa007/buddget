/** What Supabase's Send Email hook sends us, and the emails it turns into. Pure, so every mapping is testable. */

export interface HookPayload {
  user?: { id?: string; email?: string; new_email?: string; user_metadata?: { full_name?: string; name?: string } }
  email_data?: {
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
    redirect_to?: string
    email_action_type?: string
    old_email?: string
  }
}

export interface PlannedEmail {
  key: string
  to: string
  vars: { code?: string; link?: string; new_email?: string; old_email?: string }
}

const SCENARIO: Record<string, string> = {
  signup: 'confirm_signup',
  invite: 'invite_user',
  magiclink: 'sign_in_code',
  recovery: 'password_reset',
  email_change: 'email_change',
  reauthentication: 'reauthentication',
  password_changed_notification: 'password_changed',
  email_changed_notification: 'email_changed',
}

/** Notices Supabase can send that we deliberately don't (off by default there): acknowledged, not mailed. */
export const IGNORED_TYPES = new Set(['phone_changed_notification', 'identity_linked_notification', 'identity_unlinked_notification', 'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification'])

export type HookPlan = { ok: true; emails: PlannedEmail[] } | { ok: false; ignored: true } | { ok: false; ignored?: false; error: string }

export function verifyLink(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  return `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirectTo)}`
}

export function planAuthEmails(p: HookPayload, supabaseUrl: string): HookPlan {
  const type = p.email_data?.email_action_type ?? ''
  if (IGNORED_TYPES.has(type)) return { ok: false, ignored: true }
  const key = SCENARIO[type]
  const user = p.user
  const d = p.email_data ?? {}
  if (!key || !user?.email) return { ok: false, error: `Unsupported email type: ${type || 'unknown'}` }
  const redirect = d.redirect_to ?? ''
  const link = (hash: string | undefined) => (hash ? verifyLink(supabaseUrl, hash, type, redirect) : undefined)

  if (type === 'email_change') {
    const target = user.new_email || user.email
    // Secure email change: two codes. Supabase pairs them crosswise (token with token_hash_new for the current address,
    // token_new with token_hash for the new one). Otherwise one code goes to the new address.
    if (d.token_hash_new && d.token_new) {
      return {
        ok: true,
        emails: [
          { key, to: user.email, vars: { code: d.token, link: link(d.token_hash_new), new_email: target } },
          { key, to: target, vars: { code: d.token_new, link: link(d.token_hash), new_email: target } },
        ],
      }
    }
    return { ok: true, emails: [{ key, to: target, vars: { code: d.token, link: link(d.token_hash), new_email: target } }] }
  }
  if (type === 'email_changed_notification') {
    return { ok: true, emails: [{ key, to: d.old_email || user.email, vars: { old_email: d.old_email, new_email: user.email } }] }
  }
  if (type === 'password_changed_notification') return { ok: true, emails: [{ key, to: user.email, vars: {} }] }
  return { ok: true, emails: [{ key, to: user.email, vars: { code: d.token, link: link(d.token_hash) } }] }
}
