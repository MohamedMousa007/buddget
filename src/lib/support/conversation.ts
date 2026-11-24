/** Pure rules for a support conversation, shared by the user routes, the portal and the UI. */

export type Speaker = 'user' | 'staff'

export interface ConversationState {
  status: string
  last_message_at: string | null
  last_message_from: string | null
  user_last_read_at?: string | null
  staff_last_read_at?: string | null
}

const after = (a: string | null | undefined, b: string | null | undefined) => !!a && (!b || Date.parse(a) > Date.parse(b))

/** The team spoke last and the user has not opened the thread since. */
export function isUnreadForUser(t: ConversationState): boolean {
  return t.last_message_from === 'staff' && after(t.last_message_at, t.user_last_read_at)
}

/** The user spoke last and no teammate has opened the ticket since. */
export function isUnreadForStaff(t: ConversationState): boolean {
  return t.last_message_from === 'user' && after(t.last_message_at, t.staff_last_read_at)
}

/** An open conversation whose last word is the user's: it is the team's turn. */
export function needsReply(t: ConversationState): boolean {
  return (t.status === 'open' || t.status === 'pending') && t.last_message_from === 'user'
}

export type UserFacingStatus = 'open' | 'waiting' | 'resolved' | 'closed'

/** Open: the team's turn. Waiting for you: the team answered. Resolved and closed as stored. */
export function userFacingStatus(t: ConversationState): UserFacingStatus {
  if (t.status === 'resolved') return 'resolved'
  if (t.status === 'closed') return 'closed'
  return t.last_message_from === 'staff' ? 'waiting' : 'open'
}

/**
 * The read position to store when a thread is shown: the newest message the reader actually received, never `now()`,
 * so a reply that lands while the request is in flight still counts as unread. Null when nothing moves it forward.
 */
export function nextReadMark(messages: ReadonlyArray<{ created_at: string }>, current: string | null | undefined): string | null {
  const newest = messages.reduce<string | null>((max, m) => (!max || Date.parse(m.created_at) > Date.parse(max) ? m.created_at : max), null)
  return newest && after(newest, current) ? newest : null
}

export const SLA_WARN_HOURS = 24
export const SLA_BREACH_HOURS = 48

/** How long a user has waited for the team, as a colour band. */
export function slaTone(waitingSince: string | null, now: number): 'ok' | 'warn' | 'breach' {
  if (!waitingSince) return 'ok'
  const hours = (now - Date.parse(waitingSince)) / 3_600_000
  return hours >= SLA_BREACH_HOURS ? 'breach' : hours >= SLA_WARN_HOURS ? 'warn' : 'ok'
}

/** A teammate's first name for the user. Staff labels fall back to an email address, which never leaves the portal. */
export function staffFirstName(label: string | null | undefined): string | null {
  const s = label?.trim()
  if (!s || s.includes('@')) return null
  return s.split(/\s+/)[0]!.slice(0, 30)
}

/** Fills saved-reply variables. A missing first name drops the placeholder and the space or comma that hung on it. */
export function applyMacroVars(text: string, vars: { firstName?: string | null }): string {
  const name = vars.firstName?.trim().split(/\s+/)[0] ?? ''
  if (name) return text.replace(/\{\{\s*first_name\s*\}\}/gi, name)
  return text.replace(/[ \t]*\{\{\s*first_name\s*\}\}(?=\s*[,!.؟?،])/gi, '').replace(/[ \t]*\{\{\s*first_name\s*\}\}/gi, '')
}

export const CSAT_COMMENT_MAX = 500
