/**
 * The one rules table behind every limit, warning and offer (monetization plan v9, "One notice system"). Pure: the state and the
 * moment go in, the notices that apply come out. A new scenario is a new row here, never a new screen.
 *
 * Severity picks the surface and rows cannot override it: information is a toast, a warning is an inline banner, anything blocked
 * is the one limit sheet. Account pages (the trial welcome and end pages, the Pro welcome) are pages, not notices; the rows that point
 * at a Flow stack card are `stack`.
 */

export type NoticeSeverity = 'info' | 'warning' | 'blocked'
export type NoticeSurface = 'toast' | 'banner' | 'sheet' | 'stack'
export type NoticeTone = 'brand' | 'warning' | 'negative' | 'positive'
export type NoticeOffer = 'sparks' | 'pro'
export type NoticeScreen = 'chat' | 'usage' | 'pro' | 'plans' | 'balance' | 'flow' | 'settings' | 'other'

export type NoticeKey =
  | 'session80' | 'week80' | 'session_sparks' | 'session_block' | 'session_block_first' | 'week_block' | 'both_block' | 'pro_week' | 'trial_block'
  | 'sparks_low' | 'sparks_empty' | 'buy_ok' | 'buy_fail' | 'buy_pending' | 'restored'
  | 'advisor_free' | 'advisor_used' | 'advisor_locked' | 'plan3' | 'plans_ro' | 'views7' | 'views10'
  | 'reset_granted' | 'reset_back' | 'grace' | 'cancelled' | 'expired'
  | 'trial.d3' | 'trial.d10' | 'trial.d23' | 'trial.d28' | 'trial.d37'
  | 'usage_view'

export interface NoticeState {
  plan: 'free' | 'trial' | 'pro' | 'expired'
  /** 1-based day of the 30-day trial while it runs. */
  trialDay: number | null
  /** When the trial or the paid period ended, for the follow-ups. */
  endedAt: string | null
  session: { pct: number | null; resetAt: string | null }
  week: { pct: number | null; resetAt: string | null }
  sparksLeft: number
  /** Sparks in the last pack bought, for the low-balance threshold. */
  lastPackSparks: number | null
  hasBoughtSparks: boolean
  plans: { used: number; limit: number | null; readOnly: number }
  balanceViews: { used: number; limit: number | null }
  advisor: { entitled: boolean; freeLeft: number }
  resetsUnseen: Array<'session' | 'week'>
  billing: { issue: boolean; cancelledEndsAt: string | null }
  /** Local memory: what the person has used or seen, so a nudge for something already done is skipped. */
  signals: { advisorUsed: boolean; receiptScanned: boolean; firstLimitSeen: boolean; lastLimit: { scope: 'session' | 'week'; resetAt: string } | null }
  offline: boolean
  now: number
}

export type UsageEvent =
  | { type: 'limit'; layer: 'session' | 'week' | 'both' }
  | { type: 'turn_done' }
  | { type: 'plan_create' }
  | { type: 'views_open' }
  | { type: 'advisor_pick' }
  | { type: 'purchase'; outcome: 'ok' | 'fail' | 'pending' | 'restored' }

export interface NoticeContext {
  screen: NoticeScreen
  event?: UsageEvent
}

export interface Notice {
  key: NoticeKey
  severity: NoticeSeverity
  surface: NoticeSurface
  tone: NoticeTone
  /** What the sheet offers: Sparks, Pro, or both. Pro and trial never see Pro; plan and view limits are not solved by Sparks. */
  offers: NoticeOffer[]
  /** A banner the person can snooze (✕). */
  snoozable: boolean
  /** Shown once per app session. */
  oncePerSession: boolean
  /** Shown once ever, then settled. */
  once: boolean
}

const SURFACE_OF: Record<NoticeSeverity, NoticeSurface> = { info: 'toast', warning: 'banner', blocked: 'sheet' }
const TONE_OF: Record<NoticeSeverity, NoticeTone> = { info: 'positive', warning: 'warning', blocked: 'negative' }
const DAY = 86_400_000

function make(key: NoticeKey, severity: NoticeSeverity, over: Partial<Notice> = {}): Notice {
  return { key, severity, surface: SURFACE_OF[severity], tone: TONE_OF[severity], offers: [], snoozable: severity === 'warning', oncePerSession: severity === 'blocked', once: false, ...over }
}

const isPaid = (s: NoticeState) => s.plan === 'pro' || s.plan === 'trial'
const reached = (w: { pct: number | null }) => w.pct !== null && w.pct >= 100
const near = (w: { pct: number | null }) => w.pct !== null && w.pct >= 80 && w.pct < 100

/** What a blocked limit offers: Sparks always; Pro only to a plan that does not already have its limits. */
const limitOffers = (s: NoticeState): NoticeOffer[] => (isPaid(s) ? ['sparks'] : ['sparks', 'pro'])

/** Under 20 Sparks, or under 20% of the last pack, whichever is higher. */
export const sparksLowThreshold = (lastPack: number | null): number => Math.max(20, Math.ceil((lastPack ?? 0) * 0.2))

/** The usage ring in the chat (BDG-009): the same sheet as a limit, opened on request, with the offers a limit would make. */
export const usageViewNotice = (s: NoticeState): Notice => make('usage_view', 'info', { surface: 'sheet', tone: 'brand', offers: limitOffers(s) })

/** In the chat a blocked turn shows the sheet every time (BDG-012): the person is trying to use the thing that is blocked. */
function limitEvent(s: NoticeState, layer: 'session' | 'week' | 'both', inChat: boolean): Notice {
  if (s.sparksLeft > 0) return make('session_sparks', 'info', { oncePerSession: true })
  const key: NoticeKey =
    !s.signals.firstLimitSeen ? 'session_block_first'
    : s.hasBoughtSparks ? 'sparks_empty'
    : s.plan === 'pro' && layer !== 'session' ? 'pro_week'
    : s.plan === 'trial' ? 'trial_block'
    : layer === 'both' ? 'both_block'
    : layer === 'week' ? 'week_block'
    : 'session_block'
  return make(key, 'blocked', { offers: limitOffers(s), once: key === 'session_block_first', oncePerSession: !inChat })
}

/** The notices that apply to this state, this screen and this moment. Offline shows none; money entry is held by the presenter. */
export function usageNotices(s: NoticeState, ctx: NoticeContext): Notice[] {
  if (s.offline) return []
  const out: Notice[] = []
  const e = ctx.event
  const onUsage = ctx.screen === 'usage'
  const inChat = ctx.screen === 'chat'

  // Events: something just happened.
  if (e?.type === 'limit') out.push(limitEvent(s, e.layer, inChat))
  if (e?.type === 'turn_done' && (reached(s.session) || reached(s.week)) && s.sparksLeft > 0) out.push(make('session_sparks', 'info', { oncePerSession: true }))
  if (e?.type === 'plan_create' && s.plans.limit !== null && s.plans.used >= s.plans.limit) out.push(make('plan3', 'blocked', { offers: ['pro'] }))
  if (e?.type === 'views_open' && s.balanceViews.limit !== null && s.balanceViews.used >= s.balanceViews.limit) out.push(make('views10', 'blocked', { offers: ['pro'] }))
  if (e?.type === 'advisor_pick' && !s.advisor.entitled) {
    out.push(s.advisor.freeLeft > 0 ? make('advisor_free', 'info', { surface: 'banner', tone: 'brand', snoozable: false }) : make('advisor_locked', 'blocked', { offers: ['pro'] }))
  }
  if (e?.type === 'purchase') {
    if (e.outcome === 'ok') out.push(make('buy_ok', 'info'))
    if (e.outcome === 'restored') out.push(make('restored', 'info'))
    if (e.outcome === 'fail') out.push(make('buy_fail', 'info', { tone: 'negative' }))
    if (e.outcome === 'pending') out.push(make('buy_pending', 'info', { surface: 'banner', tone: 'brand', snoozable: false }))
  }

  // State: warnings that stay while they are true.
  if ((inChat || onUsage) && near(s.session)) out.push(make('session80', 'warning'))
  else if ((inChat || onUsage) && near(s.week)) out.push(make('week80', 'warning'))
  if ((inChat || onUsage) && (reached(s.session) || reached(s.week)) && s.sparksLeft > 0 && s.sparksLeft < sparksLowThreshold(s.lastPackSparks)) out.push(make('sparks_low', 'warning'))
  if (ctx.screen === 'plans' && s.plans.readOnly > 0) out.push(make('plans_ro', 'info', { surface: 'banner', tone: 'brand', snoozable: false }))
  if (ctx.screen === 'balance' && s.balanceViews.limit !== null && s.balanceViews.used >= 7 && s.balanceViews.used < s.balanceViews.limit) out.push(make('views7', 'warning'))
  if (s.billing.issue && (onUsage || ctx.screen === 'pro' || ctx.screen === 'settings')) out.push(make('grace', 'warning', { tone: 'negative', snoozable: false }))
  if (s.billing.cancelledEndsAt && ctx.screen === 'pro') out.push(make('cancelled', 'info', { surface: 'banner', tone: 'brand' }))

  // Resets: a staff reset is a toast; a person who hit a limit hears when it is back; normal resets are silent.
  if (s.resetsUnseen.length > 0) out.push(make('reset_granted', 'info', { oncePerSession: true }))
  else if (s.signals.lastLimit && Date.parse(s.signals.lastLimit.resetAt) <= s.now) out.push(make('reset_back', 'info', { once: true }))

  if (s.plan === 'expired' && ctx.screen === 'flow') out.push(make('expired', 'info', { surface: 'stack', tone: 'brand', once: true }))

  // The 30-day trial. Each step shows once; day 3 and 10 only when the feature is unused. No countdowns.
  if (s.plan === 'trial' && s.trialDay !== null && ctx.screen === 'flow') {
    if (s.trialDay >= 3 && s.trialDay < 10 && !s.signals.advisorUsed) out.push(make('trial.d3', 'info', { surface: 'stack', tone: 'brand', once: true }))
    if (s.trialDay >= 10 && s.trialDay < 23 && !s.signals.receiptScanned) out.push(make('trial.d10', 'info', { surface: 'stack', tone: 'brand', once: true }))
    if (s.trialDay >= 23 && s.trialDay < 28) out.push(make('trial.d23', 'info', { surface: 'stack', tone: 'brand', once: true }))
  }
  if (s.plan === 'trial' && s.trialDay !== null && s.trialDay >= 28 && (onUsage || ctx.screen === 'pro')) out.push(make('trial.d28', 'warning'))
  if (s.plan === 'expired' && s.endedAt && ctx.screen === 'flow') {
    const since = s.now - Date.parse(s.endedAt)
    if (since >= 7 * DAY && since < 14 * DAY) out.push(make('trial.d37', 'info', { surface: 'stack', tone: 'brand', once: true }))
  }

  return out
}

/** A notice is skipped while it is snoozed or already settled; the presenter holds sheets and toasts during money entry. */
export function visibleNotices(
  notices: readonly Notice[],
  mem: { snoozed: Record<string, string>; settled: readonly string[]; shownThisSession: ReadonlySet<string> },
  now: number,
): Notice[] {
  return notices.filter((n) => {
    const id = `usage:${n.key}`
    if (n.once && mem.settled.includes(id)) return false
    if (n.oncePerSession && mem.shownThisSession.has(id)) return false
    if (n.snoozable && Date.parse(mem.snoozed[id] ?? '') > now) return false
    return true
  })
}

/** Priority when several apply on one surface: blocked first, then warnings, then information. */
const RANK: Record<NoticeSeverity, number> = { blocked: 0, warning: 1, info: 2 }
export const byPriority = (a: Notice, b: Notice): number => RANK[a.severity] - RANK[b.severity]
