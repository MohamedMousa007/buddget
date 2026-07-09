'use client'

import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import type { DebtCurrency } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

export interface CreditCardFormProps {
  name: string
  setName: (v: string) => void
  last4: string
  setLast4: (v: string) => void
  creditLimit: string
  setCreditLimit: (v: string) => void
  outstanding: string
  setOutstanding: (v: string) => void
  currency: DebtCurrency
  setCurrency: (c: DebtCurrency) => void
  paymentDueDay: string
  setPaymentDueDay: (v: string) => void
  graceDays: string
  setGraceDays: (v: string) => void
  minPercent: string
  setMinPercent: (v: string) => void
}

/**
 * Fiat-only fields for adding a revolving credit card debt.
 */
export function CreditCardForm({
  name,
  setName,
  last4,
  setLast4,
  creditLimit,
  setCreditLimit,
  outstanding,
  setOutstanding,
  currency,
  setCurrency,
  paymentDueDay,
  setPaymentDueDay,
  graceDays,
  setGraceDays,
  minPercent,
  setMinPercent,
}: CreditCardFormProps) {
  const t = useT()
  const input =
    'mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers'

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelName}</Label>
        <Input placeholder={t.addDebt.placeholderCardName} value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.last4Label}</Label>
        <AmountField
          mode="pin"
          label={t.addDebt.last4Label}
          placeholder={t.addDebt.last4Placeholder}
          value={last4}
          onChange={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
          className={input}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.creditLimitLabel}</Label>
          <AmountField value={creditLimit} onChange={setCreditLimit} className={input} />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCurrency}</Label>
          <DebtFiatCurrencySelect
            value={currency}
            onChange={setCurrency}
            className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.currentOutstandingLabel}</Label>
        <AmountField value={outstanding} onChange={setOutstanding} className={input} />
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">{t.addDebt.currentOutstandingHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.paymentDueDayLabel}</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={paymentDueDay}
            onChange={(e) => setPaymentDueDay(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.gracePeriodLabel}</Label>
          <Input type="number" min={1} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className={input} />
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-0.5">{t.addDebt.gracePeriodDays}</p>
        </div>
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.minPaymentLabel}</Label>
        <Input type="number" step="0.1" min={0} max={100} value={minPercent} onChange={(e) => setMinPercent(e.target.value)} className={input} />
      </div>
    </div>
  )
}
