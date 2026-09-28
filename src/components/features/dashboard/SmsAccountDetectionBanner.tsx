'use client'
import { useState } from 'react'
import { LinkIcon, PlusCircle, X } from 'lucide-react'
import { usePaymentMethodDetector } from '@/hooks/usePaymentMethodDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SelectField } from '@/components/ui/SelectField'
import { useT } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'

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
            <IconButton
              onClick={() => dismissBanner(`pm:${last4}`)}
              aria-label={t.common.dismiss}
              className="-me-2 -mt-2"
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="touch"
              onClick={() =>
                openAddPaymentMethodWithPrefill({
                  name: provider ?? '',
                  last4,
                  ...(type ? { type } : {}),
                })
              }
              className="bg-[var(--color-brand-green)]/10 text-xs text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/20"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              {t.settings.createPaymentMethod}
            </Button>
            <div className="flex items-center gap-1.5">
              <SelectField
                value={linking[last4] ?? ''}
                onChange={(v) => setLinking((l) => ({ ...l, [last4]: v }))}
                placeholder={t.settings.linkToExisting}
                aria-label={t.settings.linkToExisting}
                items={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
              />
              {linking[last4] && (
                <Button
                  onClick={() => {
                    updatePaymentMethod(linking[last4]!, { last4 })
                    dismissBanner(`pm:${last4}`)
                  }}
                  variant="outline"
                  size="touch"
                >
                  <LinkIcon className="h-3 w-3" />
                  {t.settings.linkCta}
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
