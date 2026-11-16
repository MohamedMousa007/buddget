import { describe, expect, it } from 'vitest'
import { byPriority, sparksLowThreshold, usageNotices, visibleNotices, type NoticeContext, type NoticeState } from './usageNotices'

const NOW = Date.UTC(2026, 10, 16, 12)
const base: NoticeState = {
  plan: 'free', trialDay: null, endedAt: null,
  session: { pct: 10, resetAt: null }, week: { pct: 20, resetAt: null },
  sparksLeft: 0, lastPackSparks: null, hasBoughtSparks: false,
  plans: { used: 1, limit: 2, readOnly: 0 }, balanceViews: { used: 2, limit: 10 },
  advisor: { entitled: false, freeLeft: 1 }, resetsUnseen: [], billing: { issue: false, cancelledEndsAt: null },
  signals: { advisorUsed: false, receiptScanned: false, firstLimitSeen: true, lastLimit: null },
  offline: false, now: NOW,
}
const st = (over: Partial<NoticeState> = {}): NoticeState => ({ ...base, ...over })
const keys = (s: NoticeState, ctx: NoticeContext) => usageNotices(s, ctx).map((n) => n.key)
const one = (s: NoticeState, ctx: NoticeContext) => usageNotices(s, ctx)[0]

describe('AI usage warnings', () => {
  it('80% of the session is a banner in chat and on Usage, and nowhere else', () => {
    const s = st({ session: { pct: 84, resetAt: null } })
    expect(one(s, { screen: 'chat' })).toMatchObject({ key: 'session80', surface: 'banner', tone: 'warning', snoozable: true })
    expect(keys(s, { screen: 'usage' })).toContain('session80')
    expect(keys(s, { screen: 'flow' })).toEqual([])
  })
  it('80% of the week shows only when the session is not already near its own limit', () => {
    expect(keys(st({ week: { pct: 81, resetAt: null } }), { screen: 'chat' })).toEqual(['week80'])
    expect(keys(st({ session: { pct: 90, resetAt: null }, week: { pct: 81, resetAt: null } }), { screen: 'chat' })).toEqual(['session80'])
  })
  it('a reached limit is not an 80% warning', () => {
    expect(keys(st({ session: { pct: 100, resetAt: null } }), { screen: 'chat' })).toEqual([])
  })
})

describe('a limit reached', () => {
  it('with Sparks it is a toast, not a block', () => {
    const n = one(st({ sparksLeft: 40 }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })!
    expect(n).toMatchObject({ key: 'session_sparks', surface: 'toast', severity: 'info', oncePerSession: true })
  })
  it('without Sparks it is the sheet, offering Sparks and Pro on Free', () => {
    expect(one(st(), { screen: 'chat', event: { type: 'limit', layer: 'session' } })).toMatchObject({ key: 'session_block', surface: 'sheet', offers: ['sparks', 'pro'] })
    expect(one(st(), { screen: 'chat', event: { type: 'limit', layer: 'week' } })!.key).toBe('week_block')
    expect(one(st(), { screen: 'chat', event: { type: 'limit', layer: 'both' } })!.key).toBe('both_block')
  })
  it('the first limit ever carries the one-time explanation', () => {
    const n = one(st({ signals: { ...base.signals, firstLimitSeen: false } }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })!
    expect(n).toMatchObject({ key: 'session_block_first', once: true })
  })
  it('Pro and trial never see Pro: Sparks only, with their own wording', () => {
    expect(one(st({ plan: 'pro' }), { screen: 'chat', event: { type: 'limit', layer: 'week' } })).toMatchObject({ key: 'pro_week', offers: ['sparks'] })
    expect(one(st({ plan: 'trial', trialDay: 6 }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })).toMatchObject({ key: 'trial_block', offers: ['sparks'] })
  })
  it('a person who has bought Sparks and run out is told so', () => {
    expect(one(st({ hasBoughtSparks: true }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })!.key).toBe('sparks_empty')
  })
  it('low Sparks warn under 20, or under 20% of the last pack, whichever is higher, only while over a limit', () => {
    expect(sparksLowThreshold(null)).toBe(20)
    expect(sparksLowThreshold(400)).toBe(80)
    const over = { session: { pct: 100, resetAt: null } }
    expect(keys(st({ ...over, sparksLeft: 12 }), { screen: 'usage' })).toContain('sparks_low')
    expect(keys(st({ ...over, sparksLeft: 30, lastPackSparks: 400 }), { screen: 'usage' })).toContain('sparks_low')
    expect(keys(st({ ...over, sparksLeft: 90, lastPackSparks: 400 }), { screen: 'usage' })).not.toContain('sparks_low')
    expect(keys(st({ sparksLeft: 5 }), { screen: 'usage' })).not.toContain('sparks_low')
  })
})

describe('plans, balances and the Advisor', () => {
  it('a third plan on Free is the sheet and offers Pro only', () => {
    expect(one(st({ plans: { used: 2, limit: 2, readOnly: 0 } }), { screen: 'plans', event: { type: 'plan_create' } })).toMatchObject({ key: 'plan3', surface: 'sheet', offers: ['pro'] })
    expect(keys(st({ plans: { used: 1, limit: 2, readOnly: 0 } }), { screen: 'plans', event: { type: 'plan_create' } })).toEqual([])
    expect(keys(st({ plans: { used: 9, limit: null, readOnly: 0 } }), { screen: 'plans', event: { type: 'plan_create' } })).toEqual([])
  })
  it('read-only plans after a downgrade show a banner on the plans screen only', () => {
    const s = st({ plan: 'expired', plans: { used: 4, limit: 2, readOnly: 2 } })
    expect(one(s, { screen: 'plans' })).toMatchObject({ key: 'plans_ro', surface: 'banner' })
    expect(keys(s, { screen: 'usage' })).not.toContain('plans_ro')
  })
  it('balance views warn from 7 of 10 on the card, and block on the 11th open', () => {
    expect(keys(st({ balanceViews: { used: 7, limit: 10 } }), { screen: 'balance' })).toEqual(['views7'])
    expect(keys(st({ balanceViews: { used: 6, limit: 10 } }), { screen: 'balance' })).toEqual([])
    expect(one(st({ balanceViews: { used: 10, limit: 10 } }), { screen: 'balance', event: { type: 'views_open' } })).toMatchObject({ key: 'views10', surface: 'sheet', offers: ['pro'] })
    expect(keys(st({ balanceViews: { used: 40, limit: null } }), { screen: 'balance', event: { type: 'views_open' } })).toEqual([])
  })
  it('the Advisor on Free: a free answer is a notice, a used one is the sheet; Pro has neither', () => {
    expect(one(st(), { screen: 'chat', event: { type: 'advisor_pick' } })).toMatchObject({ key: 'advisor_free', surface: 'banner' })
    expect(one(st({ advisor: { entitled: false, freeLeft: 0 } }), { screen: 'chat', event: { type: 'advisor_pick' } })).toMatchObject({ key: 'advisor_locked', surface: 'sheet', offers: ['pro'] })
    expect(keys(st({ plan: 'pro', advisor: { entitled: true, freeLeft: 0 } }), { screen: 'chat', event: { type: 'advisor_pick' } })).toEqual([])
  })
})

describe('purchases and account', () => {
  it('purchase outcomes: success and restore are positive toasts, failure a negative one, pending a quiet banner', () => {
    const ev = (outcome: 'ok' | 'fail' | 'pending' | 'restored') => one(st(), { screen: 'usage', event: { type: 'purchase', outcome } })!
    expect(ev('ok')).toMatchObject({ key: 'buy_ok', surface: 'toast', tone: 'positive' })
    expect(ev('restored')).toMatchObject({ key: 'restored', surface: 'toast' })
    expect(ev('fail')).toMatchObject({ key: 'buy_fail', surface: 'toast', tone: 'negative' })
    expect(ev('pending')).toMatchObject({ key: 'buy_pending', surface: 'banner', snoozable: false })
  })
  it('a staff reset is a toast; a person who hit a limit hears it is back; normal resets are silent', () => {
    expect(one(st({ resetsUnseen: ['week'] }), { screen: 'other' })).toMatchObject({ key: 'reset_granted', surface: 'toast' })
    const back = st({ signals: { ...base.signals, lastLimit: { scope: 'week', resetAt: new Date(NOW - 1000).toISOString() } } })
    expect(one(back, { screen: 'other' })).toMatchObject({ key: 'reset_back', once: true })
    const notYet = st({ signals: { ...base.signals, lastLimit: { scope: 'week', resetAt: new Date(NOW + 1000).toISOString() } } })
    expect(keys(notYet, { screen: 'other' })).toEqual([])
    expect(keys(st(), { screen: 'other' })).toEqual([])
  })
  it('a billing issue is a negative banner on Usage, the Pro page and Settings; it is not snoozable', () => {
    const s = st({ plan: 'pro', billing: { issue: true, cancelledEndsAt: null } })
    for (const screen of ['usage', 'pro', 'settings'] as const) expect(one(s, { screen })).toMatchObject({ key: 'grace', tone: 'negative', snoozable: false })
    expect(keys(s, { screen: 'chat' })).toEqual([])
  })
  it('a cancelled plan is a brand banner on the Pro page', () => {
    expect(one(st({ plan: 'pro', billing: { issue: false, cancelledEndsAt: '2026-12-14' } }), { screen: 'pro' })).toMatchObject({ key: 'cancelled', tone: 'brand' })
  })
  it('an expired plan is one stack card on Flow, once', () => {
    expect(one(st({ plan: 'expired' }), { screen: 'flow' })).toMatchObject({ key: 'expired', surface: 'stack', once: true })
  })
  it('offline shows nothing at all', () => {
    expect(keys(st({ offline: true, session: { pct: 99, resetAt: null } }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })).toEqual([])
  })
})

describe('the 30-day trial journey', () => {
  const trial = (day: number, over: Partial<NoticeState> = {}) => st({ plan: 'trial', trialDay: day, ...over })
  it('day 3 and day 10 show only while the feature is unused', () => {
    expect(keys(trial(3), { screen: 'flow' })).toEqual(['trial.d3'])
    expect(keys(trial(3, { signals: { ...base.signals, advisorUsed: true } }), { screen: 'flow' })).toEqual([])
    expect(keys(trial(10, { signals: { ...base.signals, advisorUsed: true } }), { screen: 'flow' })).toEqual(['trial.d10'])
    expect(keys(trial(10, { signals: { ...base.signals, advisorUsed: true, receiptScanned: true } }), { screen: 'flow' })).toEqual([])
  })
  it('day 23 is a stack card, day 28 a banner on Usage and the Pro page', () => {
    expect(one(trial(23), { screen: 'flow' })).toMatchObject({ key: 'trial.d23', surface: 'stack' })
    expect(keys(trial(28), { screen: 'usage' })).toEqual(['trial.d28'])
    expect(keys(trial(28), { screen: 'pro' })).toEqual(['trial.d28'])
    expect(keys(trial(27), { screen: 'usage' })).toEqual([])
  })
  it('day 37 is one stack card for a trial that ended a week ago, and nothing after it', () => {
    const ended = (daysAgo: number) => st({ plan: 'expired', endedAt: new Date(NOW - daysAgo * 86_400_000).toISOString() })
    expect(keys(ended(7), { screen: 'flow' })).toContain('trial.d37')
    expect(keys(ended(3), { screen: 'flow' })).not.toContain('trial.d37')
    expect(keys(ended(20), { screen: 'flow' })).not.toContain('trial.d37')
  })
  it('there is no countdown: no notice carries a timer', () => {
    for (const d of [3, 10, 23, 28]) for (const n of usageNotices(trial(d), { screen: 'flow' })) expect(n).not.toHaveProperty('countdown')
  })
})

describe('visibleNotices and priority', () => {
  const mem = (over: Partial<Parameters<typeof visibleNotices>[1]> = {}) => ({ snoozed: {}, settled: [] as string[], shownThisSession: new Set<string>(), ...over })
  it('a snoozed banner is hidden until its time, a settled once-notice never returns, a shown sheet waits for the next session', () => {
    const banner = usageNotices(st({ session: { pct: 90, resetAt: null } }), { screen: 'chat' })
    expect(visibleNotices(banner, mem({ snoozed: { 'usage:session80': new Date(NOW + 1000).toISOString() } }), NOW)).toEqual([])
    expect(visibleNotices(banner, mem({ snoozed: { 'usage:session80': new Date(NOW - 1000).toISOString() } }), NOW)).toHaveLength(1)
    const once = usageNotices(st({ plan: 'expired' }), { screen: 'flow' })
    expect(visibleNotices(once, mem({ settled: ['usage:expired'] }), NOW)).toEqual([])
    const sheet = usageNotices(st(), { screen: 'chat', event: { type: 'limit', layer: 'session' } })
    expect(visibleNotices(sheet, mem({ shownThisSession: new Set(['usage:session_block']) }), NOW)).toEqual([])
  })
  it('blocked sorts before warnings before information', () => {
    const all = usageNotices(st({ session: { pct: 90, resetAt: null }, resetsUnseen: ['week'] }), { screen: 'chat', event: { type: 'limit', layer: 'session' } })
    expect([...all].sort(byPriority).map((n) => n.severity)).toEqual(['blocked', 'warning', 'info'])
  })
})
