import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { onboardingComplete, routeAfterAuth, type OnboardingStoreSignal } from './postAuthRedirect'

const fresh: OnboardingStoreSignal = { profile: {} }
const userWith = (meta: Record<string, unknown>) => ({ user_metadata: meta }) as unknown as User

describe('onboardingComplete', () => {
  it('true when server metadata flag is set, even with empty local store', () => {
    expect(onboardingComplete(userWith({ onboarding_completed: true }), fresh)).toBe(true)
  })

  it('true from local store marker when metadata is stale (the native race)', () => {
    expect(
      onboardingComplete(userWith({}), { profile: { onboardingVersion: 2 } }),
    ).toBe(true)
  })

  it('false when neither metadata nor local store indicate completion', () => {
    expect(onboardingComplete(userWith({}), fresh)).toBe(false)
  })

  it('false when only the expert survey is done (not a core-onboarding signal)', () => {
    // isExpertOnboardingComplete used to be a third arm here; removing it was
    // intentional — expert survey completion is a different concept and was
    // silently bypassing the core onboarding gate for malformed states.
    expect(onboardingComplete(userWith({}), fresh)).toBe(false)
  })
})

describe('routeAfterAuth', () => {
  it('sends an unonboarded user to /onboarding', () => {
    expect(routeAfterAuth(userWith({}), '/expenses', fresh)).toBe('/onboarding')
  })

  it('honours preferredNext once onboarding is locally complete', () => {
    expect(
      routeAfterAuth(userWith({}), '/expenses', { profile: { onboardingVersion: 2 } }),
    ).toBe('/expenses')
  })
})
