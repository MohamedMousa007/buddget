import { apiFetchAuth } from '@/lib/apiBase'
import type { OnboardingEvent } from './events'

/** Fire-and-forget funnel event. Never throws and never blocks the screen. */
export function trackOnboarding(type: OnboardingEvent, meta: Record<string, string | number | boolean> = {}): void {
  void apiFetchAuth('/api/analytics/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, meta }),
  }).catch(() => {})
}
