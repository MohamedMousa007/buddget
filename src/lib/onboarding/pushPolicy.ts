import type { OnboardingRecord } from '@/lib/store/types'

const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Whether to hold back the first push permission prompt. A new account is asked inside the journey, where the benefit is
 * explained; an account that said "not now" is left alone for a month. Everyone else is asked as before.
 */
export function deferPushPrompt(record: OnboardingRecord | undefined, openOnboarding: boolean, now: number): boolean {
  if (openOnboarding) return true
  if (record?.push === 'later' && record.pushLaterAt) return now - Date.parse(record.pushLaterAt) < ASK_AGAIN_AFTER_MS
  return false
}
