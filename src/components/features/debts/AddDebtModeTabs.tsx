'use client'

import { useT } from '@/lib/i18n'

export interface AddDebtModeTabsProps {
  mode: 'new' | 'payment'
  onModeChange: (m: 'new' | 'payment') => void
}

/**
 * New debt vs record payment when both modes are available.
 */
export function AddDebtModeTabs({ mode, onModeChange }: AddDebtModeTabsProps) {
  const t = useT()
  return (
    <div className="flex gap-2 mb-6">
      <button
        type="button"
        onClick={() => onModeChange('new')}
        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === 'new'
            ? 'bg-[var(--color-brand-red)] text-white'
            : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
        }`}
      >
        {t.addDebt.tabNew}
      </button>
      <button
        type="button"
        onClick={() => onModeChange('payment')}
        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === 'payment'
            ? 'bg-[var(--color-brand-red)] text-white'
            : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
        }`}
      >
        {t.addDebt.tabPayment}
      </button>
    </div>
  )
}
