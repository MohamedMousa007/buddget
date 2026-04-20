/**
 * Lightweight analytics event constants + a `track()` stub.
 *
 * Zero infrastructure today — `track()` just `console.debug`s in development
 * so the event stream is visible during manual QA. When a real analytics
 * pipeline is wired up (e.g. Supabase `/api/admin/analytics`, PostHog,
 * Segment), swap the body without touching call sites.
 */

export const AUTH_EVENTS = {
  emailSubmitted: 'auth.email_submitted',
  emailStateResolved: 'auth.email_state_resolved',
  passwordSubmitted: 'auth.password_submitted',
  backToEmail: 'auth.back_to_email',
  morphFallback: 'auth.morph_fallback',
  droppedAt: 'auth.dropped_at',
} as const

export const ONBOARDING_EVENTS = {
  coreGateStart: 'onboarding.core_gate_start',
  coreGateStepAdvanced: 'onboarding.core_gate_step_advanced',
  coreGateCompleted: 'onboarding.core_gate_completed',
  checklistItemCompleted: 'onboarding.checklist_item_completed',
  checklistAllCompleted: 'onboarding.checklist_all_completed',
  checklistHidden: 'onboarding.checklist_hidden',
  budgetAutoBuildStarted: 'onboarding.budget_auto_build_started',
  budgetAutoBuilt: 'onboarding.budget_auto_built',
  budgetAutoBuildFallback: 'onboarding.budget_auto_build_fallback',
} as const

/**
 * Events for the Journey (flow v3). Kept as a separate namespace so Core
 * Gate metrics don't mix with Journey metrics during the A/B period.
 */
export const JOURNEY_EVENTS = {
  started: 'journey.started',
  pathChosen: 'journey.path_chosen',
  phaseEntered: 'journey.phase_entered',
  cardCompleted: 'journey.card_completed',
  cardSkipped: 'journey.card_skipped',
  backPressed: 'journey.back_pressed',
  aiParseCalled: 'journey.ai.parse_called',
  aiParseFailed: 'journey.ai.parse_failed',
  aiPlanCalled: 'journey.ai.plan_called',
  aiPlanFailed: 'journey.ai.plan_failed',
  fallbackPresetUsed: 'journey.fallback_preset_used',
  completed: 'journey.completed',
  abandonedAt: 'journey.abandoned_at',
} as const

type EventName =
  | (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS]
  | (typeof ONBOARDING_EVENTS)[keyof typeof ONBOARDING_EVENTS]
  | (typeof JOURNEY_EVENTS)[keyof typeof JOURNEY_EVENTS]
  | (string & {})

type EventProps = Record<string, string | number | boolean | null | undefined>

/**
 * Fire an analytics event. Safe to call from both client + server; becomes a
 * no-op outside the browser.
 */
export function track(name: EventName, props?: EventProps): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', name, props ?? {})
  }
  // Hook: future integration can POST to /api/analytics here without touching
  // call sites. Keep the signature stable.
}
