import { describe, expect, it } from 'vitest'
import { STEPS } from './SmsTrackingGuide'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

/**
 * STEPS (screenshots + hand-tuned hotspot coordinates) and the `steps` copy arrays are
 * PARALLEL — index N in one pairs with index N in the other. Nothing enforced that, and
 * adding a step to the copy alone broke the guide silently: `total` is STEPS.length, so
 * every screenshot after the new step paired with the wrong copy, and the final step
 * ("add a second keyword") became unreachable rather than throwing.
 *
 * Silent because there is no runtime error — just a guide that quietly teaches the wrong
 * taps. Hence a length check rather than trusting review.
 */
describe('SMS guide step arrays stay aligned', () => {
  it('every copy step has a screenshot/hotspot entry, in both languages', () => {
    expect(en.smsTracking.guide.steps).toHaveLength(STEPS.length)
    expect(ar.smsTracking.guide.steps).toHaveLength(STEPS.length)
  })

  it('the last copy step is reachable — total comes from STEPS', () => {
    // The guide clamps to STEPS.length - 1, so a longer copy array hides its own tail.
    expect(en.smsTracking.guide.steps[STEPS.length - 1]).toBeDefined()
    expect(en.smsTracking.guide.steps[STEPS.length]).toBeUndefined()
  })

  it('every step renders something — an image or the concept screen', () => {
    for (const [i, s] of STEPS.entries()) {
      expect(s.img ?? s.concept, `STEPS[${i}] would render blank`).toBeTruthy()
    }
  })
})
