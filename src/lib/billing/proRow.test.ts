import { describe, expect, it } from 'vitest'
import { menuShowsProRow, proRowState } from './proRow'
import type { SubscriptionView } from './subscriptionView'

const NOW = Date.parse('2026-11-19T12:00:00Z')
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString()
const view = (over: Partial<SubscriptionView>): SubscriptionView => ({ kind: 'free', proActive: false, period: null, trialDay: null, trialTotal: 30, until: null, memberSince: null, ...over })

describe('proRowState', () => {
  it.each([
    [{ kind: 'free' }, 'free'],
    [{ kind: 'active', proActive: true, until: day(20) }, 'active'],
    [{ kind: 'canceled', proActive: true, until: day(20) }, 'canceled'],
    [{ kind: 'issue', proActive: true, until: day(5) }, 'issue'],
    [{ kind: 'expired', until: day(-16) }, 'ended'],
    [{ kind: 'trial', proActive: true, until: day(12) }, 'trial'],
    [{ kind: 'trial', proActive: true, until: day(4) }, 'trial'],
    [{ kind: 'trial', proActive: true, until: day(3) }, 'trialEnding'],
    [{ kind: 'trial', proActive: true, until: day(2) }, 'trialEnding'],
  ] as const)('%j → %s', (over, state) => expect(proRowState(view(over), NOW)).toBe(state))

  it('a trial with no end date is treated as ending, not as open-ended', () => {
    expect(proRowState(view({ kind: 'trial', proActive: true, until: null }), NOW)).toBe('trialEnding')
  })
})

describe('menuShowsProRow', () => {
  it('only offers Pro where there is something to do', () => {
    expect(['free', 'trial', 'trialEnding', 'issue'].every((s) => menuShowsProRow(s as never))).toBe(true)
    expect(['active', 'canceled', 'ended'].some((s) => menuShowsProRow(s as never))).toBe(false)
  })
})
