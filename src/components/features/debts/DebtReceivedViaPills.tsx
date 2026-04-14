'use client'

import { Label } from '@/components/ui/label'
import type { DebtReceivedVia } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

const OPTIONS: { value: DebtReceivedVia; emoji: string }[] = [
  { value: 'cash', emoji: '💵' },
  { value: 'bank_transfer', emoji: '🏦' },
  { value: 'card', emoji: '💳' },
  { value: 'crypto', emoji: '🪙' },
  { value: 'gold', emoji: '✦' },
  { value: 'other', emoji: '⋯' },
]

type Props = {
  value: DebtReceivedVia
  onChange: (v: DebtReceivedVia) => void
  disabled?: boolean
}

function labelFor(t: ReturnType<typeof useT>['addDebt'], v: DebtReceivedVia): string {
  switch (v) {
    case 'cash':
      return t.receivedViaCash
    case 'bank_transfer':
      return t.receivedViaBank
    case 'card':
      return t.receivedViaCard
    case 'crypto':
      return t.receivedViaCrypto
    case 'gold':
      return t.receivedViaGold
    default:
      return t.receivedViaOther
  }
}

/** How the user received borrowed funds; gold implies gram tracking. */
export function DebtReceivedViaPills({ value, onChange, disabled }: Props) {
  const t = useT()
  const a = t.addDebt
  return (
    <div>
      <Label className="text-xs text-[var(--color-brand-text-secondary)]">{a.receivedViaLabel}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              value === o.value
                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="mr-1" aria-hidden>
              {o.emoji}
            </span>
            {labelFor(a, o.value)}
          </button>
        ))}
      </div>
    </div>
  )
}
