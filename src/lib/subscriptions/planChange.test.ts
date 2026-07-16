import { describe, expect, it } from 'vitest'
import type { Subscription } from '@/lib/store/types'
import { detectPlanChange, planForAmount } from './planChange'

type Sub = Pick<Subscription, 'brandKey' | 'catalogRegion' | 'currency' | 'planId' | 'amount'>

// Netflix Egypt (verified): Basic 110, Standard 190, Premium 270 EGP.
const netflix = (over: Partial<Sub> = {}): Sub => ({
  brandKey: 'netflix', catalogRegion: 'egypt', currency: 'EGP',
  planId: 'netflix_standard', amount: 190, ...over,
})

describe('planForAmount', () => {
  it('identifies the plan a charge matches', () => {
    expect(planForAmount(netflix(), 270)?.id).toBe('netflix_premium')
  })

  it('matches within tolerance', () => {
    expect(planForAmount(netflix(), 265)?.id).toBe('netflix_premium')
  })

  it('returns null for an amount that is no plan', () => {
    expect(planForAmount(netflix(), 2_000)).toBeNull()
  })

  it('compares against the region the sub was PRICED against, not where the user is now', () => {
    // 49 is Netflix Standard in AED. For an Egypt-priced sub it is not a plan at all —
    // travelling must not look like a plan change.
    expect(planForAmount(netflix(), 49)).toBeNull()
  })

  it('returns null for a custom subscription with no brand', () => {
    expect(planForAmount(netflix({ brandKey: null }), 270)).toBeNull()
  })

  it('returns null when the region was never recorded', () => {
    expect(planForAmount(netflix({ catalogRegion: null }), 270)).toBeNull()
  })

  it('will not compare a USD-quoted plan to a charge in another currency', () => {
    // ChatGPT Plus is $20 worldwide; a 20 EGP charge is not that plan.
    const chatgpt: Sub = {
      brandKey: 'chatgpt_plus', catalogRegion: 'egypt', currency: 'EGP',
      planId: 'chatgpt_plus_plus', amount: 20,
    }
    expect(planForAmount(chatgpt, 20)).toBeNull()
  })
})

describe('detectPlanChange', () => {
  it('reports an upgrade', () => {
    expect(detectPlanChange(netflix(), 270)).toEqual({
      plan: expect.objectContaining({ id: 'netflix_premium' }),
      direction: 'upgrade',
    })
  })

  it('reports a downgrade', () => {
    expect(detectPlanChange(netflix(), 110)).toEqual({
      plan: expect.objectContaining({ id: 'netflix_basic' }),
      direction: 'downgrade',
    })
  })

  it('is silent when the charge is the plan the user is already on', () => {
    expect(detectPlanChange(netflix(), 190)).toBeNull()
  })

  it('is silent for a price that is simply different — a promo or proration is NOT a plan change', () => {
    // The single most important case: guessing here would rewrite what the user told us.
    expect(detectPlanChange(netflix(), 150)).toBeNull()
    expect(detectPlanChange(netflix(), 95)).toBeNull()
  })

  it('is silent when we never recorded which plan they were on', () => {
    expect(detectPlanChange(netflix({ planId: null }), 270)).toBeNull()
  })
})
