'use client'

import { useMemo } from 'react'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { PocketTile } from '@/components/features/savings-v3/MoneySheetParts'
import { Card } from '@/components/ui/card'
import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { coveredParts, shortfallEpisodes } from '@/lib/savings/shortfall'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SavingsAccount } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { accountDisplayName, moneyFlex } from './accountDisplay'

interface Row {
  key: string
  name: string
  tile: SavingsAccount
  amount: number
  where: string
  notCovered: number
}

/** One group of the list, built like the shared picker list: a heading with its count, then the rows. */
function Group({ title, rows, money }: { title: string; rows: Row[]; money: (n: number) => string }) {
  const c = useAccountsLtCopy().v9
  if (rows.length === 0) return null
  return (
    <Card padding="none" className="overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2.5 px-4 pb-1.5 pt-3">
        <span className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{rows.length}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className={`flex min-h-16 items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[var(--color-brand-border)]' : ''}`}>
          <PocketTile account={r.tile} className="size-10 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>
            <span dir="auto" className="mt-0.5 block truncate text-xs text-[var(--color-brand-text-secondary)]">{r.where}</span>
          </span>
          <span className="shrink-0 text-end">
            <span className="block font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{money(r.amount)}</span>
            {r.notCovered > 0 ? (
              <span dir="auto" className="block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-amber)]">{c.notCovered(money(r.notCovered))}</span>
            ) : null}
          </span>
        </div>
      ))}
    </Card>
  )
}

/**
 * Set aside (final UI v9): everything kept in accounts for pockets and goals, grouped Pockets / Goals, each with its
 * amount (base currency), where it is kept and what is "not covered" while its account is short (§4.2 uncover order).
 */
export function SetAsideListSheet({ open, onClose, onShort }: { open: boolean; onClose: () => void; onShort: (accountId: string) => void }) {
  const all = useT()
  const c = useAccountsLtCopy()
  const ledger = useLedgerInput()
  const goals = useFinanceStore((s) => s.goals)
  const base = useFinanceStore((s) => String(s.settings.baseCurrency))
  const money = (n: number) => moneyFlex(n, base)

  const { pockets, goalRows, total, short } = useMemo(() => {
    const methods = new Map(ledger.paymentMethods.map((m) => [m.id, m]))
    const cov = coveredParts(ledger, goals)
    const toBase = (n: number, cur: string) => (cur === base ? n : ledger.convert(n, cur, base) ?? n)
    const held = ledger.savingsAccounts.filter((p) => p.heldInPaymentMethodId && methods.has(p.heldInPaymentMethodId) && p.currentBalance > 0)
    const placeOf = (p: SavingsAccount) => {
      const m = methods.get(p.heldInPaymentMethodId as string)!
      return { name: accountDisplayName(m), amount: moneyFlex(p.currentBalance, String(p.currency)) }
    }
    const row = (key: string, name: string, parts: SavingsAccount[]): Row => {
      const places = parts.map(placeOf)
      return {
        key, name, tile: parts[0],
        amount: parts.reduce((n, p) => n + toBase(p.currentBalance, String(p.currency)), 0),
        where: places.length === 1 ? c.v9.inAccount(places[0].name) : c.v9.inPlaces(places.map((x) => c.v9.inAccount(`${x.name} · ${x.amount}`))),
        notCovered: parts.reduce((n, p) => n + toBase(Math.max(0, p.currentBalance - (cov.get(p.id) ?? p.currentBalance)), String(p.currency)), 0),
      }
    }
    const byGoal = new Map<string, SavingsAccount[]>()
    const loose: SavingsAccount[] = []
    for (const p of held) {
      if (p.goalId && goals.some((g) => g.id === p.goalId)) byGoal.set(p.goalId, [...(byGoal.get(p.goalId) ?? []), p])
      else loose.push(p)
    }
    const pockets = loose.map((p) => row(p.id, pocketDisplayName(p, all.savingsForms.systemNames), [p]))
    const goalRows = [...byGoal].map(([id, parts]) => row(id, goals.find((g) => g.id === id)!.name, parts))
    const episode = shortfallEpisodes(ledger)[0]
    const shortAcct = episode ? methods.get(episode.accountId) : undefined
    return {
      pockets, goalRows,
      total: [...pockets, ...goalRows].reduce((n, r) => n + r.amount, 0),
      short: episode && shortAcct ? { id: episode.accountId, text: c.v9.shortWarn(accountDisplayName(shortAcct), moneyFlex(episode.short, episode.currency)) } : null,
    }
  }, [ledger, goals, base, c, all.savingsForms.systemNames])

  return (
    <SheetFrame open={open} onClose={onClose} title={c.v9.setAsideTitle} subtitle={c.v9.setAsideSub(money(total))}>
      {short ? (
        <button type="button" onClick={() => onShort(short.id)} data-raw-button-ok="the shortfall notice, a whole-card tap target"
          className="flex w-full items-center gap-3 rounded-2xl bg-[var(--color-brand-amber-soft)] px-3.5 py-3 text-start">
          <TriangleAlert aria-hidden className="size-5 shrink-0 text-[var(--color-brand-amber)]" />
          <span className="min-w-0 flex-1 text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]">
            <b className="font-semibold">{short.text}</b> {c.short.bannerBody}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
        </button>
      ) : null}
      <Group title={c.v9.pockets} rows={pockets} money={money} />
      <Group title={c.v9.goals} rows={goalRows} money={money} />
      <p className="px-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{c.v9.setAsideFootnote}</p>
    </SheetFrame>
  )
}
