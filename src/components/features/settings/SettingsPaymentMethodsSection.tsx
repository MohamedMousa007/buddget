'use client'

import { CreditCard, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsPaymentMethodsSectionProps {
  store: FinanceStore
  onAddClick: () => void
}

/**
 * List of payment methods with delete and gated add.
 */
export function SettingsPaymentMethodsSection({ store, onAddClick }: SettingsPaymentMethodsSectionProps) {
  const t = useT()

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[var(--color-brand-red)]" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {t.settings.paymentMethodsTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="text-xs text-[var(--color-brand-red)] hover:text-[var(--color-brand-red-hover)]"
        >
          {t.settings.paymentMethodsAdd}
        </button>
      </div>
      <div className="space-y-2">
        {store.paymentMethods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between py-2 border-b border-[var(--color-brand-border)] last:border-0 group"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color || '#fff' }} />
              <div>
                <p className="text-sm text-white">{method.name}</p>
                <p className="text-xs text-[var(--color-brand-text-muted)]">
                  {method.type.replace('_', ' ')} · {method.currency}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.settings.paymentMethodsRemoveConfirm)) {
                  store.deletePaymentMethod(method.id)
                }
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-900/30"
            >
              <Trash2 className="w-3.5 h-3.5 text-[var(--color-brand-red)]" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
