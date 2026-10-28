import type { Dictionary } from '@/lib/i18n/types'
import { STALE_MAIN_DAYS } from '@/lib/devices/policy'

export type ServerCopyArgs =
  | { kind: 'carry'; amount: number; currency: string }
  | { kind: 'device_none'; cause: 'removed' | 'stale' }
  | { kind: 'device_main'; deviceName: string; cause: 'removed' | 'stale' }
  | { kind: 'device_joined'; deviceName: string }
  | { kind: 'support_resolved'; subject: string; number: number }

/** Localized {title, body} for notifications the server writes outside the alert evaluators. */
export function renderServerCopy(dict: Dictionary, a: ServerCopyArgs): { title: string; body: string } {
  const n = dict.serverNotifications
  const cause = (c: 'removed' | 'stale') => (c === 'removed' ? n.causeRemoved : n.causeStale(STALE_MAIN_DAYS))
  switch (a.kind) {
    case 'carry':
      return { title: n.carryTitle, body: n.carryBody(Math.round(a.amount).toLocaleString('en-US'), a.currency) }
    case 'device_none':
      return { title: n.deviceNoneTitle, body: n.deviceNoneBody(cause(a.cause)) }
    case 'device_main':
      return { title: n.deviceMainTitle(a.deviceName), body: n.deviceMainBody(cause(a.cause)) }
    case 'device_joined':
      return { title: n.deviceJoinedTitle, body: n.deviceJoinedBody(a.deviceName) }
    case 'support_resolved':
      return { title: n.supportResolvedTitle(a.subject).slice(0, 80), body: n.supportResolvedBody(a.number) }
  }
}
