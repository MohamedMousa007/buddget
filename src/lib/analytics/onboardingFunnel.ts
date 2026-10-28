/** The shape the admin onboarding-funnel endpoint returns, shared with the portal view. */
export interface OnboardingFunnel {
  started: number
  completed: number
  left: number
  steps: Array<{ step: string; viewed: number; completed: number }>
  permissions: Array<{ kind: string; granted: boolean | null; users: number }>
}
