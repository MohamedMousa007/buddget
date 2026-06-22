/**
 * Contract test: the complete-journey route MUST write both
 * `onboarding_completed` AND `onboarding_version` to the profiles table.
 *
 * Why this matters: the Supabase sync's pull() reads `onboarding_version` from
 * the DB on every data pull and overwrites the local store. If the API doesn't
 * set it, every pull resets onboardingVersion to 0 → onboardingComplete()
 * returns false → AuthProvider redirects the user back to /onboarding in a loop.
 * This test ensures both fields are always present in the profiles update call.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const routeSrc = readFileSync(
  join(import.meta.dirname, 'route.ts'),
  'utf8',
)

describe('complete-journey route contract', () => {
  it('sets onboarding_completed in the profiles update', () => {
    expect(routeSrc).toContain('onboarding_completed: true')
  })

  it('sets onboarding_version in the profiles update — prevents sync-pull overwrite loop', () => {
    // This was the root cause of BUD-41 (attempt 5): the API set
    // onboarding_completed but not onboarding_version, so pull() kept resetting
    // the local store to 0 and bouncing users back to /onboarding.
    expect(routeSrc).toContain('onboarding_version: 2')
  })

  it('both fields appear in the same .update() call', () => {
    const updateMatch = routeSrc.match(/\.update\(\{[^}]+\}\)/s)
    expect(updateMatch).not.toBeNull()
    const updateBlock = updateMatch![0]
    expect(updateBlock).toContain('onboarding_completed')
    expect(updateBlock).toContain('onboarding_version')
  })
})
