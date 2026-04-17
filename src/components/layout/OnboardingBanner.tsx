'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock3, X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getOnboardingCompletionPercent, isExpertOnboardingComplete } from '@/lib/onboarding/onboardingProgress'
import { useAuth } from '@/components/auth/AuthProvider'
import { useT } from '@/lib/i18n'

const REMIND_LATER_HOURS = 48
const MAX_TIMEOUT_MS = 2_147_483_647 // setTimeout cap (~24.8 days)

/**
 * Minimal, dismissible banner shown above every main-app page when onboarding isn't
 * complete. Three actions: Continue (CTA), Remind me later (48h snooze), Dismiss (permanent).
 */
export function OnboardingBanner() {
  const pathname = usePathname()
  const t = useT()
  const { user, loading } = useAuth()
  const store = useFinanceStore()
  const { settings, updateSettings, onboardingState } = store
  const remindAt = settings.onboardingBannerRemindAt

  // Stable mount-time timestamp for the snooze comparison. Not recomputed per render
  // (keeps React purity rule happy) and is "good enough" for a 48-hour banner snooze.
  const [mountTs] = useState<number>(() => Date.now())
  // Increments when a scheduled snooze expires, forcing the banner back into view.
  const [, setExpiredTick] = useState(0)

  useEffect(() => {
    if (!remindAt) return
    const until = new Date(remindAt).getTime()
    if (!Number.isFinite(until)) return
    const ms = until - Date.now()
    if (ms <= 0) return
    const id = setTimeout(() => setExpiredTick((n) => n + 1), Math.min(ms, MAX_TIMEOUT_MS))
    return () => clearTimeout(id)
  }, [remindAt])

  // Derived purely from stable state — no Date.now() during render.
  let snoozed = false
  if (remindAt) {
    const until = new Date(remindAt).getTime()
    snoozed = Number.isFinite(until) && until > mountTs
  }

  if (loading || !user) return null
  if (settings.dismissOnboardingBanner) return null
  if (isExpertOnboardingComplete(onboardingState)) return null
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/profile')) return null
  if (snoozed) return null

  const pct = getOnboardingCompletionPercent(store, t)

  const dismiss = () => {
    updateSettings({ dismissOnboardingBanner: true })
  }

  const remindLater = () => {
    const next = new Date(Date.now() + REMIND_LATER_HOURS * 60 * 60 * 1000).toISOString()
    updateSettings({ onboardingBannerRemindAt: next })
  }

  return (
    <div className="px-4 py-1.5 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-brand-text-primary)] shrink-0">
            {t.onboarding.bannerFinishShort}
          </span>
          <div className="flex-1 min-w-0 h-1 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-red)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
          <span className="text-[11px] font-mono-numbers text-[var(--color-brand-text-muted)] shrink-0 tabular-nums">
            {pct}%
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/onboarding?redo=1"
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
          >
            {t.onboarding.bannerCta}
          </Link>
          <button
            type="button"
            onClick={remindLater}
            className="p-1.5 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            aria-label={t.onboarding.bannerRemindLater}
            title={t.onboarding.bannerRemindLater}
          >
            <Clock3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            aria-label={t.onboarding.bannerDismiss}
            title={t.onboarding.bannerDismiss}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
