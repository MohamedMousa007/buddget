'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getOnboardingCompletionPercent, isExpertOnboardingComplete } from '@/lib/onboarding/onboardingProgress'
import { useAuth } from '@/components/auth/AuthProvider'

export function OnboardingBanner() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const onboardingState = useFinanceStore((s) => s.onboardingState)

  if (loading || !user) return null
  if (isExpertOnboardingComplete(onboardingState)) return null
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/profile')) return null

  const pct = getOnboardingCompletionPercent(onboardingState)

  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[var(--color-brand-text-muted)] mb-1">
            Finish onboarding for smarter budget suggestions
          </p>
          <div className="h-1.5 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-red)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{pct}%</p>
        </div>
        <Link
          href="/onboarding?redo=1"
          className="shrink-0 text-center text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
        >
          Complete onboarding
        </Link>
      </div>
    </div>
  )
}
