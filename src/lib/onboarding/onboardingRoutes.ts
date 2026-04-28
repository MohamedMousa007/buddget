/** Stable URL paths for the page-based onboarding stepper + budget preview. */

export const ONBOARDING_BASE = '/onboarding'
/** Full-screen first budget plan after onboarding (not under `/onboarding/`). */
export const BUDGET_PREVIEW_PATH = '/budget-preview'

export function onboardingStepPath(index: number): string {
  return `${ONBOARDING_BASE}/step/${index}`
}

export function onboardingPreviewPath(): string {
  return BUDGET_PREVIEW_PATH
}
