'use client'

import { createClient } from '@/lib/supabase/client'

const REFRESH_RETRY_BUDGET = 4
const REFRESH_RETRY_DELAY_MS = 250

/**
 * Calls `complete-journey`, then refreshes session JWT so middleware unlocks.
 */
export async function finalizeOnboardingAuthSession(): Promise<boolean> {
  let completed = false
  try {
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 6_000)
    try {
      const res = await fetch('/api/auth/complete-journey', {
        method: 'POST',
        signal: controller.signal,
      })
      completed = res.ok
    } finally {
      window.clearTimeout(abortTimer)
    }
  } catch (e) {
    console.error('[finalizeOnboardingAuthSession] complete-journey', e)
  }
  if (!completed) return false
  const supabase = createClient()
  for (let attempt = 0; attempt < REFRESH_RETRY_BUDGET; attempt++) {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.user?.user_metadata?.onboarding_completed === true) return true
    } catch (e) {
      console.error('[finalizeOnboardingAuthSession] refreshSession', e)
    }
    if (attempt < REFRESH_RETRY_BUDGET - 1) {
      await new Promise((r) => window.setTimeout(r, REFRESH_RETRY_DELAY_MS))
    }
  }
  return true
}
