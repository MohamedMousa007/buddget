/**
 * Onboarding uses Supabase client env at runtime; avoid static prerender in CI
 * where NEXT_PUBLIC_* secrets are absent unless injected in the workflow.
 */
export const dynamic = 'force-dynamic'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
