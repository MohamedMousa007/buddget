import { describe, expect, it } from 'vitest'
import type { RewardsState, TierKey } from '@/lib/loyalty/rewardsTypes'
import { rewardsCopy } from '@/lib/i18n/rewardsCopy'
import type { BillingMe } from '@/lib/billing/billingStore'
import { cardProgress, cardTier, shopRowState, streakPoints, streakStrip, stripCounts, stripWeeks, weekSinceJoin } from './rewardsState'
import { memberMarks } from './useMemberMarks'

const tier = (key: TierKey, minPoints: number, requiresPro = false, requiresFounder = false) => ({ key, name: key, minPoints, requiresPro, requiresFounder, sparksGift: 0, perks: [] })
const TIERS = [tier('silver', 0), tier('emerald', 300), tier('diamond', 800), tier('elite', 1500, true), tier('founder', 1500, true, true)]
const state = (over: Partial<RewardsState>): RewardsState => ({
  tiersEnabled: true, tier: { key: 'emerald', name: 'Emerald', locked: false }, proActive: false, points: { lifetime: 540, spendable: 200 },
  nextTier: { key: 'diamond', name: 'Diamond', minPoints: 800, pointsToGo: 260, requiresPro: false }, tiers: TIERS,
  streak: { current: 6, best: 9, multiplier: 1.5, nextMultiplierAt: 8, weeks: [], repair: null }, freezes: { banked: 1, max: 2, earnEvery: 4, keptWeeksToNext: 2 },
  founder: null, betaTester: false, memberNumber: 42, packBonusPercent: 0, cosmetics: { cardFinish: 'standard', buddgyLook: 'classic', owned: [] },
  shop: [], earn: [], invite: { enabled: true, code: 'LAYLA-7K2', link: 'https://buddget.app/i/LAYLA-7K2', invited: 0, activated: 0, rewarded: 0 }, ...over,
})

describe('the tier the rewards card shows', () => {
  it('a normal tier shows as it is, unlocked', () => {
    expect(cardTier(state({}))).toEqual({ tier: 'emerald', locked: false })
    expect(cardProgress(state({}), 'emerald')).toBe(48)
  })
  it('Elite points without Pro: the server says Diamond, the card shows Elite greyed and locked', () => {
    const s = state({ tier: { key: 'diamond', name: 'Diamond', locked: false }, points: { lifetime: 1980, spendable: 0 }, nextTier: { key: 'elite', name: 'Elite', minPoints: 1500, pointsToGo: 0, requiresPro: true } })
    expect(cardTier(s)).toEqual({ tier: 'elite', locked: true })
    expect(cardProgress(s, 'elite')).toBe(100)
  })
  it('a founder in the same place sees Elite Founder locked', () => {
    expect(cardTier(state({ tier: { key: 'diamond', name: 'Diamond', locked: false }, points: { lifetime: 1500, spendable: 0 }, founder: { number: 23, cohort: 'beta', creditName: null, creditNameStatus: 'none' } }))).toEqual({ tier: 'founder', locked: true })
  })
  it('Diamond below the Elite line is plain Diamond; Elite with Pro is unlocked', () => {
    expect(cardTier(state({ tier: { key: 'diamond', name: 'Diamond', locked: false }, points: { lifetime: 1210, spendable: 0 } }))).toEqual({ tier: 'diamond', locked: false })
    expect(cardTier(state({ tier: { key: 'elite', name: 'Elite', locked: false }, proActive: true, points: { lifetime: 1980, spendable: 0 } }))).toEqual({ tier: 'elite', locked: false })
  })
  it('tiers switched off: no card', () => {
    expect(cardTier(state({ tier: null }))).toBeNull()
  })
})

describe('the streak strip', () => {
  const weeks = (['kept', 'kept', 'missed', 'kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'kept', 'kept'] as const).map((s, i) => ({ week: `2026-09-${i + 1}`, state: s }))
  it('this week is lit when kept and ringed while open', () => {
    expect(stripWeeks([...weeks, { week: 'now', state: 'kept' }]).at(-1)).toBe('current')
    expect(stripWeeks([...weeks, { week: 'now', state: 'open' }]).at(-1)).toBe('pending')
    expect(stripWeeks([{ week: 'a', state: 'before' }, { week: 'b', state: 'open' }, { week: 'now', state: 'open' }])).toEqual(['missed', 'missed', 'pending'])
  })
  it('counts kept, frozen and missed for the spoken summary', () => {
    expect(stripCounts([...weeks, { week: 'now', state: 'kept' }])).toEqual({ kept: 10, frozen: 1, missed: 1 })
  })
  it('streak points follow the real rule: 10 a week, x1.5 from week 4, x2 from week 8', () => {
    expect(streakPoints(0)).toBe(0)
    expect(streakPoints(3)).toBe(30)
    expect(streakPoints(6)).toBe(75)
    expect(streakPoints(8)).toBe(110)
  })
})

describe('the strip counted from the week the user joined', () => {
  type S = RewardsState['streak']['weeks'][number]['state']
  /** The server's 12 weeks, oldest first, ending with this week (2026-11-16). */
  const server = (...tail: S[]) => [...Array<S>(12 - tail.length).fill('before'), ...tail].map((state, i) => ({ week: `w${i}`, state }))
  const kinds = (s: ReturnType<typeof streakStrip>) => s.cells.map((c) => c.week)
  const numbers = (s: ReturnType<typeof streakStrip>) => s.cells.map((c) => c.n)
  const en = rewardsCopy.en.rewards.streak

  it('week number from the join date, on the server week grid', () => {
    expect(weekSinceJoin('2026-11-16', '2026-11-16')).toBe(1)
    expect(weekSinceJoin('2026-11-16', '2026-11-19')).toBe(1)
    expect(weekSinceJoin('2026-11-16', '2026-11-15')).toBe(2)
    expect(weekSinceJoin('2026-11-16', '2026-11-09')).toBe(2)
    expect(weekSinceJoin('2026-11-16', '2026-11-08')).toBe(3)
    expect(weekSinceJoin('2026-11-16', '2026-08-17')).toBe(14)
  })
  it('joined this week: week 1 ringed, the other 11 dashed, nothing padded before it', () => {
    const s = streakStrip(server('open', 'open'), 1)
    expect(kinds(s)).toEqual(['pending', ...Array(11).fill('future')])
    expect(numbers(s)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect([s.from, s.to, s.shown.length]).toEqual([1, 1, 1])
    expect(en.range(s.from, s.to)).toBe('Week 1 · since you joined')
  })
  it('week 3: two kept weeks, this week ringed, nine dashed', () => {
    const s = streakStrip(server('kept', 'kept', 'open'), 3)
    expect(kinds(s)).toEqual(['kept', 'kept', 'pending', ...Array(9).fill('future')])
    expect(en.range(s.from, s.to)).toBe('Weeks 1–3 · since you joined')
  })
  it('week 9 with a frozen week 5, this week kept', () => {
    const s = streakStrip(server('kept', 'kept', 'kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'kept'), 9)
    expect(kinds(s)).toEqual(['kept', 'kept', 'kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'current', 'future', 'future', 'future'])
    expect(numbers(s).slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(stripCounts(s.shown)).toEqual({ kept: 8, frozen: 1, missed: 0 })
    expect(en.range(s.from, s.to)).toBe('Weeks 1–9 · since you joined')
  })
  it('week 14: the latest 12, weeks 3 to 14, no dashed cells', () => {
    const weeks = server('kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'kept', 'frozen', 'kept', 'kept', 'kept', 'kept')
    const s = streakStrip(weeks, 14)
    expect(numbers(s)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(kinds(s)).toEqual(stripWeeks(weeks))
    expect(s.shown).toHaveLength(12)
    expect(en.range(s.from, s.to)).toBe('Weeks 3–14 · you joined in week 1')
  })
  it('a missed week stays an empty cell in its place', () => {
    const s = streakStrip(server('kept', 'missed', 'kept', 'open'), 4)
    expect(kinds(s).slice(0, 5)).toEqual(['kept', 'missed', 'kept', 'pending', 'future'])
    expect(stripCounts(s.shown)).toEqual({ kept: 2, frozen: 0, missed: 1 })
  })
  it('weeks before the join never show, even a seasonal freeze or last week still open', () => {
    const s = streakStrip(server('frozen', 'open', 'open'), 1)
    expect(kinds(s)[0]).toBe('pending')
    expect(kinds(s).filter((k) => k === 'frozen')).toHaveLength(0)
  })
})

describe('a shop row', () => {
  const finish = { key: 'card_finish_aurora', kind: 'card_finish' as const, item: 'aurora', cost: 150 }
  it('repair needs a week that can still be repaired; a freeze needs room', () => {
    expect(shopRowState({ key: 'repair_week', kind: 'repair', item: null, cost: 120 }, state({}))).toBe('unavailable')
    expect(shopRowState({ key: 'repair_week', kind: 'repair', item: null, cost: 120 }, state({ streak: { ...state({}).streak, repair: { week: '2026-11-09', cost: 120, until: '2026-11-18T00:00:00Z' } } }))).toBe('buy')
    expect(shopRowState({ key: 'streak_freeze', kind: 'freeze', item: null, cost: 80 }, state({}))).toBe('buy')
    expect(shopRowState({ key: 'streak_freeze', kind: 'freeze', item: null, cost: 80 }, state({ freezes: { banked: 2, max: 2, earnEvery: 4, keptWeeksToNext: 0 } }))).toBe('unavailable')
  })
  it('a cosmetic is bought once, then owned, then in use', () => {
    expect(shopRowState(finish, state({}))).toBe('buy')
    const owned = { cardFinish: 'standard', buddgyLook: 'classic', owned: [{ kind: 'card_finish' as const, key: 'aurora', source: 'shop' as const }] }
    expect(shopRowState(finish, state({ cosmetics: owned }))).toBe('owned')
    expect(shopRowState(finish, state({ cosmetics: { ...owned, cardFinish: 'aurora' } }))).toBe('in_use')
  })
})

describe('the marks beside a name', () => {
  const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, rewards: state({}), ...over })
  it('Free at Emerald: the badge, no PRO tag, no chip', () => {
    expect(memberMarks(me({}), rewardsCopy.en)).toMatchObject({ tier: 'emerald', proTag: undefined, founderNumber: null, line: 'Free · Emerald' })
  })
  it('a trial carries the PRO tag; a founder carries the number', () => {
    expect(memberMarks(me({ planKey: 'plus_trial', status: 'trialing', trialEndsAt: '2026-12-16T00:00:00Z' }), rewardsCopy.en)).toMatchObject({ proTag: 'PRO', line: 'Pro trial · Emerald' })
    expect(memberMarks(me({ rewards: state({ founder: { number: 23, cohort: 'beta', creditName: null, creditNameStatus: 'none' } }) }), rewardsCopy.en)).toMatchObject({ founderNumber: '#023', line: 'Founder #023 · Emerald' })
  })
  it('nothing while billing is off', () => {
    expect(memberMarks(me({ billingEnabled: false }), rewardsCopy.en)).toMatchObject({ tier: null, proTag: undefined, line: '' })
  })
})
