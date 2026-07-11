'use client'

import { useMemo } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { DebtReceivedViaPills } from '@/components/features/debts/DebtReceivedViaPills'
import { DebtCurrencyField } from '@/components/ui/CurrencyField'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { DebtCurrency, DebtKind, DebtReceivedVia, GoldKarat } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'

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
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <span className={MODAL_LABEL_CLASS}>
            {isGold ? t.addDebt.labelTotalGrams : t.addDebt.labelTotalAmount}
          </span>
          <AmountField
            placeholder={t.addDebt.placeholderAmount}
            value={startingBalance}
            onChange={setStartingBalance}
            className={`mt-1.5 ${MODAL_CONTROL_CLASS} font-mono-numbers`}
          />
        </div>
        {!isGold ? (
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addDebt.labelCurrency}</span>
            <DebtCurrencyField
              value={currency}
              onChange={setCurrency}
              className="mt-1.5 w-full h-12 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm focus:border-[var(--color-brand-focus)]"
            />
          </div>
        ) : (
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addDebt.labelGoldPurity}</span>
            <SelectField
              value={String(goldKarat)}
              onChange={(v) => setGoldKarat(parseInt(v, 10) as GoldKarat)}
              items={karatItems}
              className="mt-1.5"
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
