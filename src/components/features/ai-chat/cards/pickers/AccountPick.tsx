'use client'

import { useId } from 'react'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'

export interface AccountOption {
  value: string
  name: string
  sub?: string
  color?: string
  balance?: string
}

export interface AccountPickProps {
  value: string
  options: AccountOption[]
  onPick: (value: string) => void
  label?: string
}

/** One account out of a few, as the account rows look: mark, name, kind and balance. */
export function AccountPick({ value, options, onPick, label }: AccountPickProps) {
  const copy = useBuddgyCardCopy().account
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-[0.8125rem] font-semibold">{label ?? copy.label}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
        {options.map((a) => (
          <SelectableCard key={a.value} selected={a.value === value} onClick={() => onPick(a.value)} aria-label={a.sub ? `${a.name}, ${a.sub}` : a.name}>
            <span className="flex min-h-10 w-full items-center gap-3 text-start">
              <BrandMark name={a.name} color={a.color ?? 'var(--color-brand-primary)'} size={34} logo={bankLogoForName(a.name)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{a.name}</span>
                {a.sub ? <span className="text-xs text-[var(--color-brand-text-muted)]">{a.sub}</span> : null}
              </span>
              {a.balance ? <span className="font-mono-numbers text-[0.8125rem] font-semibold tabular-nums">{a.balance}</span> : null}
            </span>
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}
