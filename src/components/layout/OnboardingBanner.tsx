'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { ONBOARDING_V2_STEP_COUNT } from '@/lib/onboarding/v2/constants'
import { useT } from '@/lib/i18n'

/**
 * Persistent CTA while `onboarding_completed` is false. Progress follows
 * `onboardingState.currentStepIndex` against the V2 onboarding step count.
 */
export function OnboardingBanner() {
  const pathname = usePathname()
  const t = useT()
  const { user, loading } = useAuth()
  const currentStepIndex = useFinanceStore(
    useShallow((s) => s.onboardingState.currentStepIndex ?? 0),
  )

  if (loading || !user) return null
  if (user.user_metadata?.onboarding_completed === true) return null
  if (!pathname) return null
  if (pathname.startsWith('/onboarding') || pathname === '/budget-preview') return null

  const totalCards = ONBOARDING_V2_STEP_COUNT
  const doneCount = Math.max(0, Math.min(currentStepIndex, totalCards))
  const pct = totalCards > 0 ? Math.round((doneCount / totalCards) * 100) : 0

  return (
    <Link
      href="/onboarding"
      className="block px-4 py-1.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 hover:bg-[var(--color-brand-elevated)] transition-colors"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--color-brand-text-primary)] shrink-0">
          {t.onboarding.checklistTitle}
        </span>
        <div className="flex-1 min-w-0 h-1 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-brand-red)] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-[var(--color-brand-text-muted)] shrink-0">
          {t.onboarding.checklistProgress(doneCount, totalCards)}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)] rtl:rotate-180 shrink-0" aria-hidden />
      </div>
    </Link>
  )
}
