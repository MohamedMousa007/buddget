'use client'

import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useEffect, useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { cashOut } from '@/lib/accounts/actions'
import { depositsThatNeverLeft, resolveSurplus, transferSources, type SurplusAnswer } from '@/lib/accounts/gapSurplus'
import { computeBalances } from '@/lib/accounts/balance'
import type { GapResult } from '@/lib/accounts/gap'
import { snoozeGap } from '@/lib/accounts/useAccountGaps'
import { findUnplacedForAccount } from '@/lib/accounts/unplacedForTail'
import type { Expense } from '@/lib/store/types'
import { useAccounts, useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
import { AccountPicker } from './AccountPicker'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { localTodayISO } from '@/lib/utils/localDate'
import { useT } from '@/lib/i18n'
import { GapTimeline, type TimelineStep } from './GapTimeline'
import { moneyFlex } from './accountDisplay'

type Choice = 'cash' | 'spent' | 'set' | 'unsure' | 'attach' | SurplusAnswer

interface FixGapSheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
  gap: GapResult
  onSetAside: (amount: number) => void
  onResolved: () => void
}

/** A bank balance the ledger does not explain, shown as a timeline and resolved with one plain answer. The bank showing more gets its own answers. */
export function FixGapSheet({ open, onClose, account, gap, onSetAside, onResolved }: FixGapSheetProps) {
  const t = useT().accountsPage
  const { formatPattern } = useLocalizedFormatters()
  const shortDate = (iso: string) => formatPattern(new Date(iso), 'MMM d')
  const ledger = useLedgerInput()
  const addExpense = useFinanceStore((s) => s.addExpense)
  const updateExpense = useFinanceStore((s) => s.updateExpense)
  const [picked, setPicked] = useState<Choice | null>(null)
  const cur = String(account.method.currency)
  const money = (n: number) => moneyFlex(n, cur)
  const missing = Math.abs(gap.amount)
  const surplus = gap.amount > 0
  const { accounts } = useAccounts()
  const sources = useMemo(() => {
    const ids = new Set(transferSources(ledger.paymentMethods, account.method).map((m) => m.id))
    return accounts.filter((a) => ids.has(a.method.id))
  }, [accounts, ledger.paymentMethods, account.method])
  const [fromId, setFromId] = useState<string | null>(null)
  const fromAccountId = sources.find((a) => a.method.id === fromId)?.method.id ?? sources[0]?.method.id
  const neverLeft = useMemo(
    () => depositsThatNeverLeft(ledger, account.method, gap),
    [ledger, account.method, gap],
  )
  // Money the bank's own messages already described: placing it is the first thing to try, before guessing where cash went.
  const [unplaced, setUnplaced] = useState<Expense[]>([])
  useEffect(() => {
    if (!open) return
    let off = false
    void findUnplacedForAccount(ledger.expenses, account.method).then((rows) => { if (!off) setUnplaced(rows) }).catch(() => undefined)
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account.method.id, ledger.expenses.length])

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
      { key: 'c', title: surplus ? t.extraWord : t.missingWord, sub: t.notInEntries, amount: `${surplus ? '+' : '−'}${money(missing)}`, tone: 'gap' },
      { key: 'd', title: t.bankConfirmed, sub: shortDate(gap.newest.reportedAt), amount: money(gap.newest.balance), tone: 'ok' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, gap, account.method.id])

  const neverLeftTotal = neverLeft.reduce((n, x) => n + x.amount, 0)
  const tiles: Array<{ id: Choice; name: string; sub: string; cta: string; likely?: boolean }> = surplus ? [
    ...(neverLeft.length > 0 ? [{ id: 'pocket' as const, name: t.pocketNeverLeft, sub: t.pocketNeverLeftSub(money(neverLeftTotal)), cta: t.undoPocketDeposit }] : []),
    { id: 'income', name: t.incomeNotLogged, sub: t.incomeNotLoggedSub, cta: t.addAsIncome },
    ...(sources.length > 0 ? [{ id: 'transfer' as const, name: t.transferIn, sub: t.transferInSub, cta: t.recordTransfer }] : []),
    { id: 'correct', name: t.correctBalance, sub: t.correctBalanceSub, cta: t.setBalanceTo(money(gap.newest.balance)) },
    { id: 'unsure', name: t.notSure, sub: t.notSureSub, cta: t.remindMeLater },
  ] : [
    ...(unplaced.length > 0
      ? [{ id: 'attach' as const, name: t.attachMessagesName, sub: t.attachMessagesSub(unplaced.length, money(unplaced.reduce((a, e) => a + Math.max(0, e.amount - (e.refundedAmount ?? 0)), 0))), cta: t.attachMessagesCta, likely: true }]
      : []),
    { id: 'cash', name: t.cashWithdrawal, sub: t.cashWithdrawalSub, cta: t.logCashWithdrawal, },
    { id: 'spent', name: t.iSpentIt, sub: t.iSpentItSub, cta: t.addTheExpense },
    { id: 'set', name: t.setAsideAction, sub: t.pocketSub, cta: t.moveIntoPocket },
    { id: 'unsure', name: t.notSure, sub: t.notSureSub, cta: t.remindMeLater },
  ]

  // A pick whose tile has gone (its messages were just placed) falls back to the first one rather than leaving no tile selected.
  const choice: Choice = picked && tiles.some((x) => x.id === picked) ? picked : tiles[0].id

  // The money left before the newest bank report, so the resolving entry is dated just before it: that is what lets the report match.
  const apply = () => {
    const at = new Date(new Date(gap.newest.reportedAt).getTime() - 60_000)
    if (choice === 'income' || choice === 'transfer' || choice === 'pocket' || choice === 'correct') {
      // Undoing a pocket deposit covers what those deposits add up to; every other answer covers the whole difference.
      if (!resolveSurplus(choice, { account: account.method, amount: missing, reportedAt: gap.newest.reportedAt, fromAccountId, deposits: neverLeft })) return
    }
    else if (choice === 'attach') { for (const e of unplaced) updateExpense(e.id, { paymentMethodId: account.method.id }) }
    else if (choice === 'cash') cashOut(account.method.id, missing, account.method.currency, at)
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
          <V3SheetHeader.Title>{(surplus ? t.extraTitle : t.missingTitle)(money(missing))}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{surplus ? t.extraSub : t.missingSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-3 pt-3">
          <GapTimeline steps={steps} />
          <div>
            <p className="mb-3 text-[17px] font-bold text-[var(--color-brand-text-primary)]">{surplus ? t.whereDidItComeFrom : t.whereDidItGo}</p>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={surplus ? t.whereDidItComeFrom : t.whereDidItGo}>
              {tiles.map((x) => (
                <SelectableCard key={x.id} layout="stack" selected={choice === x.id} onClick={() => setPicked(x.id)} role="radio" aria-checked={choice === x.id}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{x.name}</span>
                    {x.likely ? <Badge variant="positive">{t.likely}</Badge> : null}
                  </span>
                  <span className="text-[0.78125rem] text-[var(--color-brand-text-muted)]">{x.sub}</span>
                </SelectableCard>
              ))}
            </div>
            {choice === 'transfer' && fromAccountId ? (
              <div className="mt-3"><AccountPicker accounts={sources} value={fromAccountId} onChange={setFromId} /></div>
            ) : null}
          </div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <Button size="cta-block" onClick={apply} className="font-semibold">{tiles.find((x) => x.id === choice)!.cta}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
