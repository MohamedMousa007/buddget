'use client'

import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { AccountPicker } from '@/components/features/accounts/AccountPicker'
import type { LegAccount } from '@/components/features/savings-v3/useLegAccount'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor, pocketDisplayName, pocketIdentity } from '@/lib/savings/pocketIdentity'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import type { PocketVM } from '@/components/features/savings-v3/types'
import type { Currency } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

/** A translucent wash of a (CSS-variable or hex) colour. */
export const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

/** One-of-many pocket choice shared by Add money (Into) and Withdraw (From). */
export function PocketRadioList({ pockets, value, onChange, label }: {
  pockets: PocketVM[]
  value: string | null
  onChange: (id: string) => void
  label: string
}) {
  const sf = useT().savingsForms
  return (
    <div role="radiogroup" aria-label={label} className="space-y-2">
      {pockets.map(({ account }) => {
        const color = pocketColor(account)
        return (
          <SelectableCard key={account.id} selected={value === account.id} onClick={() => onChange(account.id)}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tint(color, 14), color }}>
              <SavingsAccountIcon account={account} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{pocketDisplayName(account, sf.systemNames)}</p>
              <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{pocketIdentity(account, sf.identity)}</p>
            </div>
            <span className="font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{fmtNum(account.currentBalance)}</span>
          </SelectableCard>
        )
      })}
    </div>
  )
}

/** The app's amount + currency row: glass AmountField beside a compact CurrencyField. */
export function AmountCurrencyRow({ amount, onAmount, currency, onCurrency, amountLabel, currencyLabel, includeGold }: {
  amount: string
  onAmount: (v: string) => void
  currency: Currency
  onCurrency: (c: Currency) => void
  amountLabel: string
  currencyLabel: string
  /** Offer gold (XAU) in the picker, for debt currency choices. */
  includeGold?: boolean
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0,1fr) 108px' }}>
      <div>
        <p style={micro}>{amountLabel}</p>
        <div className="mt-2"><AmountField value={amount} onChange={onAmount} decimalsFor={currency} placeholder="0" /></div>
      </div>
      <div>
        <p style={micro}>{currencyLabel}</p>
        <CurrencyField
          compact
          value={currency}
          includeGold={includeGold}
          onChange={(c) => onCurrency(c as unknown as Currency)}
          className="mt-2 h-[52px] w-full rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"
        />
      </div>
    </div>
  )
}

/** The one "From account" (deposit) / "To account" (withdraw) row; hidden when no tracked account can carry the leg. */
export function AccountLegRow({ leg, label }: { leg: LegAccount; label: string }) {
  if (leg.views.length === 0 || !leg.accountId) return null
  return (
    <div>
      <AccountPicker accounts={leg.views} value={leg.accountId} onChange={leg.setAccountId} label={label} />
    </div>
  )
}
