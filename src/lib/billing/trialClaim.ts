import { apiFetchAuth } from '@/lib/apiBase'
import type { TrialStatus } from '@/lib/entitlements/trial'

/** Claims the 14-day trial; callers gate on `billingEnabled`. Null on any failure. */
export async function claimTrial(): Promise<TrialStatus | null> {
  try {
    const res = await apiFetchAuth('/api/entitlements/trial', { method: 'POST' })
    if (!res.ok) return null
    return ((await res.json()) as { status: TrialStatus }).status
  } catch {
    return null
  }
}
