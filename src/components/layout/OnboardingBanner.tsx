'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getOnboardingCompletionPercent, isExpertOnboardingComplete } from '@/lib/onboarding/onboardingProgress'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

export function OnboardingBanner() {
  const pathname = usePathname()
  const t = useT()
  const { user, loading } = useAuth()
  const store = useFinanceStore()
  const { settings, updateSettings, onboardingState } = store

  if (loading || !user) return null
  if (settings.dismissOnboardingBanner) return null
  if (isExpertOnboardingComplete(onboardingState)) return null
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/profile')) return null

  const pct = getOnboardingCompletionPercent(store, t)

  const dismiss = () => {
    updateSettings({ dismissOnboardingBanner: true })
    window.alert(t.onboarding.bannerDismiss)
  }

  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[var(--color-brand-text-muted)] mb-1">
            {t.onboarding.bannerTagline}
          </p>
          <div className="h-1.5 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-red)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{pct}%</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={dismiss}
            className="p-2 rounded-xl border border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            aria-label="Dismiss onboarding reminder"
          >
            <X className="w-4 h-4" />
          </button>
          <Link
            href="/onboarding?redo=1"
            className="text-center text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
          >
            {t.onboarding.bannerCta}
          </Link>
        </div>
      </div>
    </div>
  )
}
