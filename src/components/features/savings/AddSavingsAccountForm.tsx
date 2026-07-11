'use client'

import { useMemo, useState } from 'react'
import { SavingsProductTypePicker } from '@/components/modals/SavingsProductTypePicker'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { OTHER_SAVINGS_ICON_KEYS, SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { INVESTMENT_PRODUCT_TYPES, SAVINGS_PRODUCT_TYPES } from '@/lib/constants/savingsTypes'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, SavingsAccountCategory, SavingsType } from '@/lib/store/types'
import {
  buildSavingsCurrencyOptions,
  pickDefaultSavingsCurrency,
} from '@/lib/savings/savingsCurrencyOptions'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface AddSavingsAccountFormProps {
  /** Invoked after a successful create; sheet owners typically close here. */
  onDone: () => void
}

const tab = (on: boolean) =>
  cn(
    'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
    on
      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
  )

/**
 * Create-account form (category + type + icon + name + opening balance + notes + submit).
 * Used standalone by `AddSavingsAccountSheet` and embedded as a tab in `AddToSavingsSheet`.
 */
export function AddSavingsAccountForm({ onDone }: AddSavingsAccountFormProps) {
  const t = useT()
  const settings = useFinanceStore((s) => s.settings)
  const addSavingsAccount = useFinanceStore((s) => s.addSavingsAccount)

  const [productCategory, setProductCategory] = useState<SavingsAccountCategory>('savings')
  const [savingsType, setSavingsType] = useState<SavingsType>('bank')
  const [otherIcon, setOtherIcon] = useState<string>(SAVINGS_TYPE_ICONS.other)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>(() => pickDefaultSavingsCurrency(settings, 'bank'))
  const [openingBalance, setOpeningBalance] = useState('')
  const [notes, setNotes] = useState('')

  const typeList = productCategory === 'savings' ? SAVINGS_PRODUCT_TYPES : INVESTMENT_PRODUCT_TYPES

  const currencyOptions = useMemo(
    () => buildSavingsCurrencyOptions(settings, savingsType),
    [settings, savingsType]
  )

  const pickCategory = (cat: SavingsAccountCategory) => {
    setProductCategory(cat)
    const first = cat === 'savings' ? SAVINGS_PRODUCT_TYPES[0] : INVESTMENT_PRODUCT_TYPES[0]
    setSavingsType(first)
    setCurrency(pickDefaultSavingsCurrency(settings, first))
  }

  const onPickType = (st: SavingsType) => {
    setSavingsType(st)
    setCurrency(pickDefaultSavingsCurrency(settings, st))
  }

  const submit = () => {
    if (!name.trim()) return
    const bal = parseFloat(openingBalance)
    const resolvedIcon = savingsType === 'other' ? otherIcon : SAVINGS_TYPE_ICONS[savingsType]
    addSavingsAccount({
      name: name.trim(),
      category: productCategory,
      type: savingsType,
      icon: resolvedIcon,
      currency,
      notes: notes.trim() || undefined,
      ...(Number.isFinite(bal) && bal > 0 ? { openingBalance: bal } : {}),
    })
    setProductCategory('savings')
    setSavingsType('bank')
    setOtherIcon(SAVINGS_TYPE_ICONS.other)
    setName('')
    setCurrency(pickDefaultSavingsCurrency(settings, 'bank'))
    setOpeningBalance('')
    setNotes('')
    onDone()
  }

  const inputClass =
    'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]'

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelProductCategory}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={tab(productCategory === 'savings')} onClick={() => pickCategory('savings')}>
            {t.savings.categorySavings}
          </button>
          <button
            type="button"
            className={tab(productCategory === 'investment')}
            onClick={() => pickCategory('investment')}
          >
            {t.savings.categoryInvestment}
          </button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelType}</Label>
        <div className="mt-2">
          <SavingsProductTypePicker
            types={typeList}
            value={savingsType}
            labels={t.savings.types}
            onSelect={onPickType}
          />
        </div>
      </div>

      {savingsType === 'other' && (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelPickIcon}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {OTHER_SAVINGS_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setOtherIcon(key)}
                className={cn(
                  'rounded-xl border p-2 transition-colors',
                  otherIcon === key
                    ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10'
                    : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] hover:border-[var(--color-brand-red)]/25'
                )}
                aria-label={key}
              >
                <SavingsAccountIcon account={{ type: 'other', icon: key }} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelName}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.savings.placeholders[savingsType]}
          className={cn('mt-1 h-10', inputClass)}
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelCurrentBalance}</Label>
        <div className="mt-1 flex gap-2 items-stretch">
          <div className="w-28 shrink-0">
            <SelectField
              value={currency}
              onChange={(v) => setCurrency(v as Currency)}
              items={currencyOptions as ReadonlyArray<SelectFieldOption>}
              aria-label={t.savings.labelCurrency}
            />
          </div>
          <AmountField
            value={openingBalance}
            onChange={setOpeningBalance}
            placeholder="0.00"
            className={cn('h-10 flex-1 font-mono-numbers', inputClass)}
          />
        </div>
        {savingsType === 'gold' ? (
          <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">{t.savings.goldCurrencyHint}</p>
        ) : null}
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelNotes}</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={cn(
            'mt-1 w-full min-h-[4.5rem] resize-y px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand-focus)]/30',
            inputClass
          )}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        className="w-full rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
      >
        {t.savings.createAccountButton}
      </button>
    </div>
  )
}
