'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { SavingsProductTypePicker } from '@/components/modals/SavingsProductTypePicker'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { OTHER_SAVINGS_ICON_KEYS, SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { INVESTMENT_PRODUCT_TYPES, SAVINGS_PRODUCT_TYPES } from '@/lib/constants/savingsTypes'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, SavingsAccount, SavingsAccountCategory, SavingsType } from '@/lib/store/types'
import { buildSavingsCurrencyOptions, pickDefaultSavingsCurrency } from '@/lib/savings/savingsCurrencyOptions'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const tab = (on: boolean) =>
  cn(
    'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
    on
      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
  )

export interface EditSavingsAccountSheetProps {
  open: boolean
  onClose: () => void
  account: SavingsAccount | null
}

/**
 * Edit name, category, product type, currency, and notes for an existing savings row.
 */
export function EditSavingsAccountSheet({ open, onClose, account }: EditSavingsAccountSheetProps) {
  if (!open || !account) return null
  return <EditSavingsAccountForm key={account.id} account={account} onClose={onClose} />
}

function EditSavingsAccountForm({ account, onClose }: { account: SavingsAccount; onClose: () => void }) {
  const t = useT()
  const settings = useFinanceStore((s) => s.settings)
  const updateSavingsAccount = useFinanceStore((s) => s.updateSavingsAccount)

  const [productCategory, setProductCategory] = useState<SavingsAccountCategory>(account.category)
  const [savingsType, setSavingsType] = useState<SavingsType>(account.type)
  const [otherIcon, setOtherIcon] = useState(
    account.type === 'other' && account.icon ? account.icon : SAVINGS_TYPE_ICONS.other
  )
  const [name, setName] = useState(account.name)
  const [currency, setCurrency] = useState<Currency>(account.currency)
  const [notes, setNotes] = useState(account.notes ?? '')

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
    const resolvedIcon = savingsType === 'other' ? otherIcon : SAVINGS_TYPE_ICONS[savingsType]
    updateSavingsAccount(account.id, {
      name: name.trim(),
      category: productCategory,
      type: savingsType,
      icon: resolvedIcon,
      currency,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  const inputClass =
    'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]'

  return (
    <ModalShell open onBackdropClick={onClose}>
      <div className="p-5 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetEditTitle} onClose={onClose} />
        <div className="mt-4 space-y-4">
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
              className={cn('mt-1 h-10', inputClass)}
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelCurrency}</Label>
            <SelectField
              value={currency}
              onChange={(v) => setCurrency(v as Currency)}
              items={currencyOptions as ReadonlyArray<SelectFieldOption>}
              className="mt-1"
              aria-label={t.savings.labelCurrency}
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelNotes}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={cn(
                'mt-1 w-full min-h-[4.5rem] resize-y px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand-red)]/30',
                inputClass
              )}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
