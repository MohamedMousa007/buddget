'use client'

import { useMemo, useState } from 'react'
import { parseISO } from 'date-fns'
import { Calendar, Undo2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup, TxTile } from '@/components/features/debts/lt/SheetParts'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { recordRepayment, repaymentCandidates } from '@/lib/spending/receivable'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'
import { formatFlex } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'

interface RepaidSheetProps {
  open: boolean
  onClose: () => void
  expense: Expense
  onDone: () => void
}

const NONE = 'none'

/**
 * Someone paid back what was spent for them (Light touch `repaid`): credit an account without counting it as income,
 * optionally matched to money that already came in.
 */
export function RepaidSheet({ open, onClose, expense, onDone }: RepaidSheetProps) {
  const t = useT()
  const c = useDebtsSubsLtCopy().repaid
  const { locale } = useLocale()
  const { accounts } = useAccounts()
  const incomes = useFinanceStore((s) => s.incomeEvents)
  const [accountId, setAccountId] = useState(() => accounts[0]?.method.id ?? '')
  const [amount, setAmount] = useState(String(expense.amount))
  const [fromIncomeId, setFromIncomeId] = useState<string | undefined>()
  const [matchOpen, setMatchOpen] = useState(false)
  const account = accounts.find((a) => a.method.id === accountId) ?? accounts[0]
  const currency = String(account?.method.currency ?? expense.currency)
  const candidates = useMemo(() => (account ? repaymentCandidates(expense, incomes, currency) : []), [expense, incomes, account, currency])
  const matched = candidates.find((i) => i.id === fromIncomeId)
  const value = matched ? matched.amount : parseFloat(amount)
  const valid = Boolean(account) && value > 0
  const day = (iso: string) => formatLocalized(parseISO(iso.slice(0, 10)), 'MMM d', locale)

  const submit = () => {
    if (!account || !valid) return
    recordRepayment({ expenseId: expense.id, accountId: account.method.id, amount: value, fromIncomeId })
    onDone()
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose} leading={<Pill icon={<Calendar />}>{formatDatePillLabel(localTodayISO(), locale, t.expenseForm.today)}</Pill>}>
          <span className="sr-only"><V3SheetHeader.Title>{t.exclusion.repaidTitle}</V3SheetHeader.Title></span>
        </V3SheetHeader>
        <div className="native-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
          <AmountHero
            value={matched ? String(matched.amount) : amount}
            onChange={(v) => { setFromIncomeId(undefined); setAmount(v) }}
            currency={currency}
            sign="+"
            aria-label={t.common.amountLabel}
            top={<TxTile tone="var(--color-brand-green)"><Undo2 /></TxTile>}
            className="px-0 pb-0"
          />
          <div className="-mt-2 text-center">
            <p dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{c.title(expense.owedBy || c.someone)}</p>
            <p dir="auto" className="mt-0.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
              {c.line(expense.description, day(expense.date), formatFlex(value > 0 ? value : 0), formatFlex(expense.amount))}
            </p>
          </div>
          <SheetGroup>
            {accounts.length > 0 ? (
              <MethodPickerRow label={c.into} value={account?.method.id ?? ''} onChange={(id) => { setAccountId(id); setFromIncomeId(undefined) }} paymentMethods={accounts.map((a) => a.method)} />
            ) : null}
            {candidates.length > 0 ? (
              <PickerRow
                label={c.match}
                onClick={() => setMatchOpen(true)}
                value={<span dir="auto" className="truncate">{matched ? `${matched.name} +${formatFlex(matched.amount)} · ${day(matched.receivedDate)}` : c.none}</span>}
              />
            ) : null}
          </SheetGroup>
        </div>
        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-5 pb-6 pt-3">
          <Button size="cta-block" disabled={!valid} onClick={submit}>{c.cta}</Button>
        </div>
      </div>
      <OptionSheet
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        title={c.matchTitle}
        value={fromIncomeId ?? NONE}
        onChange={(id) => setFromIncomeId(id === NONE ? undefined : id)}
        options={[
          ...candidates.map((i) => ({ value: i.id, title: `${i.name} +${formatFlex(i.amount)}`, subtitle: day(i.receivedDate) })),
          { value: NONE, title: c.none },
        ]}
        zIndexClassName="z-[110]"
      />
    </ModalShell>
  )
}
