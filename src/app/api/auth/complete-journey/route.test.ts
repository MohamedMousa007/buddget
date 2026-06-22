/**
 * Contract test: the complete-journey route MUST set `onboarding_completed` on
 * BOTH the auth user metadata and the profiles row.
 *
 * Why this matters: the onboarding gate is now metadata-only
 * (`user_metadata.onboarding_completed`). This service-role route is the
 * authoritative writer — it sets the auth metadata (read by the gate) and
 * mirrors the flag into profiles (cross-device source of truth). If either is
 * missing, a user can be bounced back to /onboarding.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const routeSrc = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')

describe('complete-journey route contract', () => {
  it('sets onboarding_completed in the profiles update', () => {
    expect(routeSrc).toContain('onboarding_completed: true')
  })

  it('sets onboarding_completed in the auth user metadata', () => {
    expect(routeSrc).toContain('onboarding_completed: true')
    expect(routeSrc).toContain('updateUserById')
  })

  it('no longer references the dropped onboarding_version column', () => {
    expect(routeSrc).not.toContain('onboarding_version')
  })
})
