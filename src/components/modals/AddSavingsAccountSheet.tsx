'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OTHER_SAVINGS_ICON_KEYS, SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { SAVINGS_TYPES_ORDER } from '@/lib/constants/savingsTypes'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, SavingsType } from '@/lib/store/types'
import {
  buildSavingsCurrencyOptions,
  pickDefaultSavingsCurrency,
} from '@/lib/savings/savingsCurrencyOptions'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface AddSavingsAccountSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Create savings with a product type (drives icon), opening balance, and optional notes.
 */
export function AddSavingsAccountSheet({ open, onClose }: AddSavingsAccountSheetProps) {
  const t = useT()
  const settings = useFinanceStore((s) => s.settings)
  const addSavingsAccount = useFinanceStore((s) => s.addSavingsAccount)

  const [savingsType, setSavingsType] = useState<SavingsType>('bank')
  const [otherIcon, setOtherIcon] = useState<string>(SAVINGS_TYPE_ICONS.other)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>(() => pickDefaultSavingsCurrency(settings, 'bank'))
  const [openingBalance, setOpeningBalance] = useState('')
  const [notes, setNotes] = useState('')

  const currencyOptions = useMemo(
    () => buildSavingsCurrencyOptions(settings, savingsType),
    [settings, savingsType]
  )

  const namePlaceholder = t.savings.placeholders[savingsType]

  const resolvedIcon = savingsType === 'other' ? otherIcon : SAVINGS_TYPE_ICONS[savingsType]

  const submit = () => {
    if (!name.trim()) return
    const bal = parseFloat(openingBalance)
    addSavingsAccount({
      name: name.trim(),
      type: savingsType,
      icon: resolvedIcon,
      currency,
      notes: notes.trim() || undefined,
      ...(Number.isFinite(bal) && bal > 0 ? { openingBalance: bal } : {}),
    })
    setSavingsType('bank')
    setOtherIcon(SAVINGS_TYPE_ICONS.other)
    setName('')
    setCurrency(pickDefaultSavingsCurrency(settings, 'bank'))
    setOpeningBalance('')
    setNotes('')
    onClose()
  }

  if (!open) return null

  const inputClass =
    'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]'

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetAddNewTitle} onClose={onClose} />
        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelType}</Label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SAVINGS_TYPES_ORDER.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setSavingsType(st)
                    setCurrency(pickDefaultSavingsCurrency(settings, st))
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                    savingsType === st
                      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/30'
                  )}
                >
                  <SavingsAccountIcon
                    account={{ type: st, icon: SAVINGS_TYPE_ICONS[st] }}
                    className="h-4 w-4 text-[var(--color-brand-text-primary)]"
                  />
                  <span className="min-w-0 leading-tight">{t.savings.types[st]}</span>
                </button>
              ))}
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
              placeholder={namePlaceholder}
              className={cn('mt-1 h-10', inputClass)}
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              {t.savings.labelCurrentBalance}
            </Label>
            <div className="mt-1 flex gap-2 items-stretch">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={cn('h-10 min-w-[5.5rem] shrink-0 rounded-xl border px-2 text-sm', inputClass)}
              >
                {currencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className={cn('h-10 flex-1 font-mono-numbers', inputClass)}
              />
            </div>
            {savingsType === 'gold' ? (
              <p className="mt-1 text-[11px] text-[var(--color-brand-text-muted)]">{t.savings.goldCurrencyHint}</p>
            ) : null}
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
            {t.savings.createAccountButton}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
