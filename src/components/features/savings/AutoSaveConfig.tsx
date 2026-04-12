'use client'

import type { SavingsAccount, SavingsAutoSave, SavingsAutoSaveMode } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export interface AutoSaveConfigProps {
  account: SavingsAccount
  onChange: (autoSave: SavingsAutoSave | undefined) => void
}

/**
 * Inline auto-save toggles for a savings bucket.
 */
export function AutoSaveConfig({ account, onChange }: AutoSaveConfigProps) {
  const t = useT()
  const as = account.autoSave ?? {
    enabled: false,
    mode: 'fixed_schedule' as const,
    amount: 100,
    frequency: 'monthly' as const,
    dayOfMonth: 1,
  }

  const patch = (u: Partial<SavingsAutoSave>) => onChange({ ...as, ...u })

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.autoSave}</span>
        <button
          type="button"
          onClick={() => (as.enabled ? onChange(undefined) : patch({ enabled: true }))}
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            as.enabled ? 'bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-border)] text-[var(--color-brand-text-muted)]'
          }`}
        >
          {as.enabled ? t.savings.autoSaveOn : t.savings.autoSaveOff}
        </button>
      </div>
      {as.enabled && (
        <div className="space-y-2 pt-1">
          <select
            value={as.mode}
            onChange={(e) => patch({ mode: e.target.value as SavingsAutoSaveMode })}
            className="w-full h-9 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 text-xs"
          >
            <option value="fixed_schedule">{t.savings.modeFixed}</option>
            <option value="end_of_month">{t.savings.modeEndOfMonth}</option>
            <option value="percent_of_income">{t.savings.modePercent}</option>
          </select>
          {(as.mode === 'fixed_schedule' || as.mode === 'percent_of_income') && (
            <div className="flex gap-2 items-center">
              <InputAmount
                value={as.mode === 'percent_of_income' ? as.percent ?? 10 : as.amount ?? 100}
                onChange={(v) =>
                  patch(as.mode === 'percent_of_income' ? { percent: v } : { amount: v })
                }
                isPercent={as.mode === 'percent_of_income'}
              />
            </div>
          )}
          {as.mode === 'fixed_schedule' && (
            <div className="flex gap-2">
              <select
                value={as.frequency ?? 'monthly'}
                onChange={(e) =>
                  patch({ frequency: e.target.value as 'weekly' | 'monthly' })
                }
                className="flex-1 h-9 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 text-xs"
              >
                <option value="monthly">{t.savings.whenMonthly}</option>
                <option value="weekly">{t.savings.whenWeekly}</option>
              </select>
              {as.frequency !== 'weekly' && (
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={as.dayOfMonth ?? 1}
                  onChange={(e) => patch({ dayOfMonth: Number(e.target.value) || 1 })}
                  className="w-16 h-9 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 text-xs font-mono-numbers"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InputAmount({
  value,
  onChange,
  isPercent,
}: {
  value: number
  onChange: (n: number) => void
  isPercent: boolean
}) {
  return (
    <input
      type="number"
      step={isPercent ? 1 : 0.01}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-9 flex-1 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 text-xs font-mono-numbers"
    />
  )
}
