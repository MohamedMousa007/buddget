'use client'

import type { InstallmentProvider } from '@/lib/store/types'
import { INSTALLMENT_PROVIDERS } from '@/lib/constants/installmentProviders'
import { useT } from '@/lib/i18n'

export interface InstallmentProviderPickerProps {
  value: InstallmentProvider
  onChange: (k: InstallmentProvider) => void
}

/**
 * BNPL / bank installment provider pills for new installment debts.
 */
export function InstallmentProviderPicker({ value, onChange }: InstallmentProviderPickerProps) {
  const t = useT()
  const label = (key: InstallmentProvider) =>
    ({
      credit_card: t.addDebt.providerCreditCard,
      tabby: t.addDebt.providerTabby,
      tamara: t.addDebt.providerTamara,
      other: t.addDebt.providerOther,
    })[key]

  return (
    <div>
      <p className="text-xs text-[var(--color-brand-text-secondary)] mb-2">{t.addDebt.installmentProviderLabel}</p>
      <div className="flex flex-wrap gap-2">
        {INSTALLMENT_PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm text-left transition-colors max-w-36 ${
              value === p.key
                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
            }`}
            style={value === p.key ? { borderColor: p.color } : undefined}
          >
            <span className="mr-1">{p.emoji}</span>
            <span className="font-medium">{label(p.key)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
