export const STALE_DAYS = 60

export interface ReviewMember {
  status: 'active' | 'suspended'
  secured: boolean
  liveSessions: number
  last_login_at: string | null
  created_at: string
  extra_permissions: readonly string[]
}

/** What a quarterly access review should look at for one teammate, most serious first. */
export function reviewFlags(m: ReviewMember, now: number): string[] {
  const out: string[] = []
  const since = (iso: string) => (now - Date.parse(iso)) / 86_400_000
  if (m.status === 'suspended' && m.liveSessions > 0) out.push('Suspended but still has live sessions')
  if (m.status === 'active' && !m.secured) out.push('Two-factor sign-in is not set up')
  if (m.status === 'active') {
    if (m.last_login_at ? since(m.last_login_at) > STALE_DAYS : since(m.created_at) > STALE_DAYS) out.push(`No sign-in for over ${STALE_DAYS} days`)
  }
  if (m.extra_permissions.length > 0) out.push(`${m.extra_permissions.length} permission${m.extra_permissions.length === 1 ? '' : 's'} added on top of the role`)
  return out
}
