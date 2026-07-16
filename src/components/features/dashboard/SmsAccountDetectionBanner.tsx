'use client'
import { useState } from 'react'
import { LinkIcon, PlusCircle, X } from 'lucide-react'
import { usePaymentMethodDetector } from '@/hooks/usePaymentMethodDetector'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export function SmsAccountDetectionBanner() {
  const detected = usePaymentMethodDetector()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [linking, setLinking] = useState<Record<string, string>>({})
  const { openAddPaymentMethodWithPrefill } = useSettingsStore()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)

  const visible = detected.filter((d) => !dismissed.includes(d.last4))
  if (!visible.length) return null

  // Floating in-app notification — overlays the page (no layout shift),
  // anchored below the safe-area inset, stacks when multiple accounts appear.
  return (
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-50 space-y-2 sm:left-auto sm:right-4 sm:w-96">
      {visible.map(({ last4, provider, type }) => (
        <div
          key={last4}
          className="animate-in slide-in-from-top-4 fade-in rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-brand-text-primary)]">
              {provider ? `${provider} ` : ''}••{last4} — new account detected
            </p>
            <button
              type="button"
              onClick={() => setDismissed((d) => [...d, last4])}
              className="shrink-0 text-[var(--color-brand-text-muted)]"
              aria-label="Dismiss"
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
              className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)]/10 px-3 py-1.5 text-xs text-[var(--color-brand-green)]"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Create Payment Method
            </button>
            <div className="flex items-center gap-1.5">
              <select
                value={linking[last4] ?? ''}
                onChange={(e) =>
                  setLinking((l) => ({ ...l, [last4]: e.target.value }))
                }
                className="rounded-xl border border-[var(--color-brand-border)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-brand-text-secondary)]"
              >
                <option value="">Link to existing…</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
              {linking[last4] && (
                <button
                  type="button"
                  onClick={() => {
                    updatePaymentMethod(linking[last4]!, { last4 })
                    setDismissed((d) => [...d, last4])
                  }}
                  className="flex items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2.5 py-1.5 text-xs text-[var(--color-brand-text-secondary)]"
                >
                  <LinkIcon className="h-3 w-3" />
                  Link
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
