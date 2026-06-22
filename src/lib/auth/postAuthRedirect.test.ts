import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { onboardingComplete, routeAfterAuth } from './postAuthRedirect'

const userWith = (meta: Record<string, unknown>) => ({ user_metadata: meta }) as unknown as User

describe('onboardingComplete', () => {
  it('true only when the server metadata flag is set', () => {
    expect(onboardingComplete(userWith({ onboarding_completed: true }))).toBe(true)
  })

  it('false when the flag is absent', () => {
    expect(onboardingComplete(userWith({}))).toBe(false)
  })

  it('false for a null user', () => {
    expect(onboardingComplete(null)).toBe(false)
  })

  it('false for any non-true value (no truthy coercion)', () => {
    expect(onboardingComplete(userWith({ onboarding_completed: 'true' }))).toBe(false)
    expect(onboardingComplete(userWith({ onboarding_completed: 1 }))).toBe(false)
  })
})

describe('routeAfterAuth', () => {
  it('sends an unonboarded user to /onboarding', () => {
    expect(routeAfterAuth(userWith({}), '/expenses')).toBe('/onboarding')
  })

  it('honours preferredNext once onboarding is complete', () => {
    expect(routeAfterAuth(userWith({ onboarding_completed: true }), '/expenses')).toBe('/expenses')
  })

  it('returns preferredNext for a null user (no redirect with no session)', () => {
    expect(routeAfterAuth(null, '/expenses')).toBe('/expenses')
  })
})
