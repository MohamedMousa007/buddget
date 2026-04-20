'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DebtReceivedViaPills } from '@/components/features/debts/DebtReceivedViaPills'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { DebtCurrency, DebtKind, DebtReceivedVia, GoldKarat } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export function AddDebtNewFormAmountBlock({
  debtType,
  receivedVia,
  onReceivedViaChange,
  startingBalance,
  setStartingBalance,
  currency,
  setCurrency,
  goldKarat,
  setGoldKarat,
  installmentPreview,
}: {
  debtType: DebtKind
  receivedVia: DebtReceivedVia
  onReceivedViaChange: (v: DebtReceivedVia) => void
  startingBalance: string
  setStartingBalance: (v: string) => void
  currency: DebtCurrency
  setCurrency: (c: DebtCurrency) => void
  goldKarat: GoldKarat
  setGoldKarat: (v: GoldKarat) => void
  installmentPreview: number | null
}) {
  const t = useT()
  const isGold = receivedVia === 'gold'
  const showGold = debtType !== 'installment' && debtType !== 'credit_card'
  const isCreditCard = debtType === 'credit_card'
  const karatItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: '24', label: t.goldPurity.k24 },
      { value: '22', label: t.goldPurity.k22 },
      { value: '21', label: t.goldPurity.k21 },
      { value: '18', label: t.goldPurity.k18 },
    ],
    [t.goldPurity],
  )

  if (isCreditCard) return null

  return (
    <>
      {showGold ? <DebtReceivedViaPills value={receivedVia} onChange={onReceivedViaChange} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <div data-tutorial-id="debt-modal:balance">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {isGold ? t.addDebt.labelTotalGrams : t.addDebt.labelTotalAmount}
          </Label>
          <Input
            type="number"
            step="0.01"
            placeholder={t.addDebt.placeholderAmount}
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
        {!isGold ? (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCurrency}</Label>
            <DebtFiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
            />
          </div>
        ) : (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGoldPurity}</Label>
            <SelectField
              value={String(goldKarat)}
              onChange={(v) => setGoldKarat(parseInt(v, 10) as GoldKarat)}
              items={karatItems}
              className="mt-1"
              aria-label={t.addDebt.labelGoldPurity}
            />
          </div>
        )}
      </div>
      {debtType === 'installment' && installmentPreview !== null ? (
        <p className="text-xs text-[var(--color-brand-text-secondary)] font-mono-numbers">
          ≈ {formatCurrency(installmentPreview, currency)} / {t.addDebt.freqMonthly.toLowerCase()}
        </p>
      ) : null}
    </>
  )
}
