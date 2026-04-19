'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { AddSavingsAccountForm } from '@/components/features/savings/AddSavingsAccountForm'
import type { Currency, SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { nextRecurringSavingsDueDate } from '@/lib/savings/recurringSavingsDates'
import { cn } from '@/lib/utils'

export interface AddToSavingsSheetProps {
  open: boolean
  onClose: () => void
  accounts: SavingsAccount[]
  defaultAccountId: string | null
  onDeposit: (accountId: string, amount: number, currency: Currency, notes?: string) => void
}

type Mode = 'deposit' | 'addAccount'

const pill = (on: boolean) =>
  cn(
    'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
    on
      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
  )

const tabBtn = (on: boolean) =>
  cn(
    'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
    on
      ? 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] shadow-sm'
      : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]'
  )

/**
 * Deposit into savings (ledger only) OR create a new savings account via the second tab.
 * Optional monthly recurring schedule on the Deposit tab.
 */
export function AddToSavingsSheet({
  open,
  onClose,
  accounts,
  defaultAccountId,
  onDeposit,
}: AddToSavingsSheetProps) {
  const showToast = useActionToast()
  const t = useT()
  const addRecurringSavingsDeposit = useFinanceStore((s) => s.addRecurringSavingsDeposit)
  const hasAccounts = accounts.length > 0
  const [mode, setMode] = useState<Mode>(hasAccounts ? 'deposit' : 'addAccount')
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const acc = accounts.find((a) => a.id === accountId)
  const accountItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${formatCurrency(a.currentBalance, a.currency)})`,
      })),
    [accounts],
  )
  const dayOfMonthItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({
        value: String(d),
        label: String(d),
      })),
    [],
  )

  if (!open) return null

  const submit = () => {
    const n = parseFloat(amount)
    if (!acc || !Number.isFinite(n) || n <= 0) return
    onDeposit(acc.id, n, acc.currency, notes.trim() || undefined)
    if (recurring) {
      addRecurringSavingsDeposit({
        accountId: acc.id,
        amount: n,
        currency: acc.currency,
        frequency: 'monthly',
        dayOfMonth,
        nextDueDate: nextRecurringSavingsDueDate(dayOfMonth),
        isActive: true,
        notes: notes.trim() || undefined,
      })
    }
    showToast(t.common.toastSavingsDeposited)
    onClose()
  }

  const inputClass =
    'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-5 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader
          title={mode === 'deposit' ? t.savings.sheetAddTitle : t.savings.sheetAddNewTitle}
          onClose={onClose}
        />

        <div
          role="tablist"
          aria-label={t.savings.pageTitle}
          className="mt-4 flex gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'deposit'}
            onClick={() => setMode('deposit')}
            disabled={!hasAccounts}
            className={cn(tabBtn(mode === 'deposit'), !hasAccounts && 'opacity-50 cursor-not-allowed')}
          >
            {t.savings.tabDeposit}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'addAccount'}
            onClick={() => setMode('addAccount')}
            className={tabBtn(mode === 'addAccount')}
          >
            {t.savings.tabAddAccount}
          </button>
        </div>

        {mode === 'deposit' ? (
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                {t.savings.labelWhichSavings}
              </Label>
              <SelectField
                value={accountId}
                onChange={setAccountId}
                items={accountItems}
                className="mt-1"
                aria-label={t.savings.labelWhichSavings}
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelAmount}</Label>
              <div className="mt-1 flex gap-2 items-center">
                <span className="flex h-10 min-w-[4rem] items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm font-mono-numbers">
                  {acc?.currency ?? '—'}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn('h-10 flex-1 font-mono-numbers', inputClass)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.recurringQuestion}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={pill(!recurring)} onClick={() => setRecurring(false)}>
                  {t.savings.recurringOneTime}
                </button>
                <button type="button" className={pill(recurring)} onClick={() => setRecurring(true)}>
                  {t.savings.recurringRepeat}
                </button>
              </div>
            </div>

            {recurring && (
              <div className="space-y-2 rounded-xl border border-[var(--color-brand-border)]/60 bg-[var(--color-brand-elevated)]/40 p-3">
                <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelFrequency}</p>
                <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{t.savings.freqMonthly}</p>
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                    {t.savings.labelDayOfMonth}
                  </Label>
                  <SelectField
                    value={String(dayOfMonth)}
                    onChange={(v) => setDayOfMonth(Number(v))}
                    items={dayOfMonthItems}
                    className="mt-1"
                    aria-label={t.savings.labelDayOfMonth}
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelNotes}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={cn('mt-1 h-10', inputClass)}
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!acc}
              className="mt-2 w-full rounded-xl bg-[var(--color-brand-green)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-green-hover)] disabled:opacity-40 transition-colors"
            >
              {t.savings.submitAdd}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <AddSavingsAccountForm onDone={onClose} />
          </div>
        )}
      </div>
    </ModalShell>
  )
}
