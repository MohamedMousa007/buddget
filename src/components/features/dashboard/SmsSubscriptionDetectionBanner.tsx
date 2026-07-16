'use client'
import { useRouter } from 'next/navigation'
import { PlusCircle, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSubscriptionDetector } from '@/hooks/useSubscriptionDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

/**
 * "We noticed a recurring charge — track it?" Never creates the subscription itself: the
 * user confirms in the add sheet, seeded with the amount actually charged.
 */
export function SmsSubscriptionDetectionBanner() {
  const detected = useSubscriptionDetector()
  const t = useT()
  const router = useRouter()
  const { dismissedBanners, dismissBanner, openAddSubscriptionWithPrefill } = useSettingsStore(
    useShallow((s) => ({
      dismissedBanners: s.dismissedBanners,
      dismissBanner: s.dismissBanner,
      openAddSubscriptionWithPrefill: s.openAddSubscriptionWithPrefill,
    })),
  )

  const visible = detected.filter((d) => !dismissedBanners.includes(`sub:${d.brandKey}`))
  if (!visible.length) return null

  return (
    <>
      {visible.map(({ brandKey, name, amount, currency, billingDay }) => (
        <div
          key={brandKey}
          className="animate-in slide-in-from-top-4 fade-in rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-brand-text-primary)]">
              {t.subscriptions.detectedTitle.replace('{brand}', name)}
            </p>
            <button
              type="button"
              onClick={() => dismissBanner(`sub:${brandKey}`)}
              className="-me-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-brand-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
              aria-label={t.common.dismiss}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              openAddSubscriptionWithPrefill({ brandKey, amount, currency, billingDay })
              router.push('/subscriptions')
            }}
            className="mt-2.5 flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-3 text-xs text-[var(--color-brand-green)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {t.subscriptions.detectedCta}
          </button>
        </div>
      ))}
    </>
  )
}
