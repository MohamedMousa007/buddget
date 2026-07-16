'use client'
import { useState } from 'react'
import { LinkIcon, PlusCircle, X } from 'lucide-react'
import { usePaymentMethodDetector } from '@/hooks/usePaymentMethodDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SelectField } from '@/components/ui/SelectField'
import { useT } from '@/lib/i18n'

export function SmsAccountDetectionBanner() {
  const detected = usePaymentMethodDetector()
  const t = useT()
  const [linking, setLinking] = useState<Record<string, string>>({})
  // Persisted: a plain useState meant the banner returned on every dashboard visit,
  // which trains people to ignore it.
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  const dismissBanner = useSettingsStore((s) => s.dismissBanner)
  const openAddPaymentMethodWithPrefill = useSettingsStore((s) => s.openAddPaymentMethodWithPrefill)
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)

  const visible = detected.filter((d) => !dismissed.includes(`pm:${d.last4}`))
  if (!visible.length) return null

  // A plain child of BannerStack, which owns the fixed position — this used to carry its
  // own `fixed … z-50` and would silently sit on top of any other banner.
  return (
    <>
      {visible.map(({ last4, provider, type }) => (
        <div
          key={last4}
          className="animate-in slide-in-from-top-4 fade-in rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-brand-text-primary)]">
              {`${provider ? `${provider} ` : ''}••${last4}`} {t.settings.accountDetected}
            </p>
            <button
              type="button"
              onClick={() => dismissBanner(`pm:${last4}`)}
              className="-me-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-brand-text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
              aria-label={t.common.dismiss}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                openAddPaymentMethodWithPrefill({
                  name: provider ?? '',
                  last4,
                  ...(type ? { type } : {}),
                })
              }
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-3 text-xs text-[var(--color-brand-green)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              {t.settings.createPaymentMethod}
            </button>
            <div className="flex items-center gap-1.5">
              <SelectField
                value={linking[last4] ?? ''}
                onChange={(v) => setLinking((l) => ({ ...l, [last4]: v }))}
                placeholder={t.settings.linkToExisting}
                aria-label={t.settings.linkToExisting}
                items={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
              />
              {linking[last4] && (
                <button
                  type="button"
                  onClick={() => {
                    updatePaymentMethod(linking[last4]!, { last4 })
                    dismissBanner(`pm:${last4}`)
                  }}
                  className="flex min-h-[44px] items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2.5 text-xs text-[var(--color-brand-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
                >
                  <LinkIcon className="h-3 w-3" />
                  {t.settings.linkCta}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
