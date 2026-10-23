'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { cashOut } from '@/lib/accounts/actions'
import { computeBalances } from '@/lib/accounts/balance'
import type { GapResult } from '@/lib/accounts/gap'
import { snoozeGap } from '@/lib/accounts/useAccountGaps'
import { useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { localTodayISO } from '@/lib/utils/localDate'
import { useT } from '@/lib/i18n'
import { GapTimeline, type TimelineStep } from './GapTimeline'
import { splitMoney } from './accountDisplay'

type Choice = 'cash' | 'spent' | 'set' | 'unsure'

interface FixGapSheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
  gap: GapResult
  onSetAside: (amount: number) => void
  onResolved: () => void
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** Unexplained money, shown as a timeline, resolved with one of four plain answers. */
export function FixGapSheet({ open, onClose, account, gap, onSetAside, onResolved }: FixGapSheetProps) {
  const t = useT().accountsPage
  const ledger = useLedgerInput()
  const addExpense = useFinanceStore((s) => s.addExpense)
  const [choice, setChoice] = useState<Choice>('cash')
  const cur = String(account.method.currency)
  const money = (n: number) => splitMoney(n, cur).int + splitMoney(n, cur).dec
  const missing = Math.abs(gap.amount)

  const steps = useMemo<TimelineStep[]>(() => {
    const at = (iso: string) => new Date(iso).getTime()
    const before = computeBalances(ledger, at(gap.previous.reportedAt))?.get(account.method.id)?.balance ?? gap.previous.balance
    const after = computeBalances(ledger, at(gap.newest.reportedAt))?.get(account.method.id)?.balance ?? gap.newest.balance
    const count = ledger.expenses.filter((e) => {
      const x = new Date(`${e.date}T12:00:00`).getTime()
      return e.paymentMethodId === account.method.id && x > at(gap.previous.reportedAt) && x <= at(gap.newest.reportedAt)
    }).length
    const net = after - before
    return [
      { key: 'a', title: t.bankConfirmed, sub: shortDate(gap.previous.reportedAt), amount: money(gap.previous.balance), tone: 'ok' },
      { key: 'b', title: t.entriesCount(count), sub: shortDate(gap.newest.reportedAt), amount: `${net < 0 ? '−' : '+'}${money(Math.abs(net))}`, tone: 'plain' },
      { key: 'c', title: t.missingWord, sub: t.notInEntries, amount: `−${money(missing)}`, tone: 'gap' },
      { key: 'd', title: t.bankConfirmed, sub: shortDate(gap.newest.reportedAt), amount: money(gap.newest.balance), tone: 'ok' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, gap, account.method.id])

  const tiles: Array<{ id: Choice; name: string; sub: string; cta: string; likely?: boolean }> = [
    { id: 'cash', name: t.cashWithdrawal, sub: t.cashWithdrawalSub, cta: t.logCashWithdrawal, likely: true },
    { id: 'spent', name: t.iSpentIt, sub: t.iSpentItSub, cta: t.addTheExpense },
    { id: 'set', name: t.setAsideAction, sub: t.pocketSub, cta: t.moveIntoPocket },
    { id: 'unsure', name: t.notSure, sub: t.notSureSub, cta: t.remindMeLater },
  ]

  // The money left before the newest bank report, so the resolving entry is dated just before it: that is what lets the report match.
  const apply = () => {
    const at = new Date(new Date(gap.newest.reportedAt).getTime() - 60_000)
    if (choice === 'cash') cashOut(account.method.id, missing, account.method.currency, at)
    else if (choice === 'spent') addExpense({ description: 'Unlogged spending', category: 'Other', amount: missing, currency: account.method.currency, date: localTodayISO(at), occurredAt: at.toISOString(), paymentMethodId: account.method.id, isRecurring: false })
    else if (choice === 'set') { onSetAside(missing); return }
    else { snoozeGap(account.method.id, gap.reportedAt); onResolved(); onClose(); return }
    onResolved()
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.missingTitle(money(missing))}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.missingSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-3 pt-3">
          <GapTimeline steps={steps} />
          <div>
            <p className="mb-3 text-[17px] font-bold text-[var(--color-brand-text-primary)]">{t.whereDidItGo}</p>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t.whereDidItGo}>
              {tiles.map((x) => (
                <SelectableCard key={x.id} layout="stack" selected={choice === x.id} onClick={() => setChoice(x.id)} role="radio" aria-checked={choice === x.id}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{x.name}</span>
                    {x.likely ? <Badge variant="positive">{t.likely}</Badge> : null}
                  </span>
                  <span className="text-[12.5px] text-[var(--color-brand-text-muted)]">{x.sub}</span>
                </SelectableCard>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <Button size="cta-block" onClick={apply} className="font-semibold">{tiles.find((x) => x.id === choice)!.cta}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
