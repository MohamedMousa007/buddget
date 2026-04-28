/**
 * Onboarding uses Supabase client env at runtime; avoid static prerender in CI
 * where NEXT_PUBLIC_* secrets are absent unless injected in the workflow.
 */
export const dynamic = 'force-dynamic'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0A0A0F] flex flex-col">{children}</div>
}
