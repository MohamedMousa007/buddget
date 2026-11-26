'use client'

import type { ReactNode } from 'react'
import { parseISO } from 'date-fns'
import { CreditCard, HandCoins, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import type { BorrowVM, CreditCardVM, InstallmentVM } from '@/hooks/useDebtTabData'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { formatFlex, formatWhole } from '@/lib/utils/formatters'
import { useLocale } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { ProviderBadge } from './ProviderBadge'

interface RowModel {
  id: string
  lead: ReactNode
  title: string
  sub: string
  amount: number
  currency: string
  /** 0–1 share paid; omitted for a card. */
  progress?: number
}

function Tile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px] [&_svg]:size-5" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
      {children}
    </span>
  )
}

/** One active debt: logo, name, what it costs and how far along, a thin progress bar, and what is still owed. */
function DebtListRow({ row, onOpen }: { row: RowModel; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">
      {row.lead}
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{row.title}</span>
        <span dir="auto" className="mt-0.5 block truncate text-xs text-[var(--color-brand-text-secondary)]">{row.sub}</span>
        {row.progress != null ? (
          <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
            <span className="block h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${Math.round(Math.min(1, Math.max(0, row.progress)) * 100)}%` }} />
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono-numbers text-[0.9375rem] font-medium tabular-nums text-[var(--color-brand-text-primary)]">
        {formatFlex(row.amount)} <span className="text-[0.6875rem] font-normal text-[var(--color-brand-text-muted)]">{row.currency}</span>
      </span>
    </button>
  )
}

/** The Active section of the Debts page: "Active n" with a quiet Add, then one row per debt of the chosen family. */
export function DebtsActiveList({ family, borrow, installments, cards, onAdd, onOpen }: {
  family: DebtFamily
  borrow: BorrowVM[]
  installments: InstallmentVM[]
  cards: CreditCardVM[]
  onAdd: () => void
  onOpen: (id: string) => void
}) {
  const c = useDebtsSubsLtCopy().debts
  const { locale } = useLocale()

  const rows: RowModel[] =
    family === 'borrow'
      ? borrow.map((vm) => ({
          id: vm.id,
          lead: <Tile tone={vm.dir === 'owed' ? 'var(--color-brand-green)' : 'var(--color-brand-amber)'}><HandCoins /></Tile>,
          title: vm.person && vm.person !== vm.name ? `${vm.name} · ${vm.person}` : vm.name,
          sub: vm.dir === 'owed'
            ? c.owedToYou
            : vm.goal
              ? [c.perMonth(formatWhole(vm.goal.per)), vm.goal.next ? c.nextOn(vm.goal.next) : ''].filter(Boolean).join(' · ')
              : c.leftOf(formatFlex(vm.remaining), formatFlex(vm.total)),
          amount: vm.remaining,
          currency: vm.gold ? 'g' : vm.currency,
          progress: vm.total > 0 ? vm.paid / vm.total : 0,
        }))
      : family === 'installment'
        ? installments.map((vm) => ({
            id: vm.id,
            lead: <ProviderBadge slug={vm.logoSlug} name={vm.providerName} size={40} />,
            title: vm.item ? `${vm.item} · ${vm.providerName}` : vm.providerName,
            sub: [c.perMonth(formatWhole(vm.per)), c.leftOf(Math.max(0, vm.count - vm.paid), vm.count), vm.overdueDays > 0 ? c.late(vm.overdueDays) : vm.next ? c.nextOn(vm.next) : ''].filter(Boolean).join(' · '),
            amount: vm.remaining,
            currency: vm.currency,
            progress: vm.count > 0 ? vm.paid / vm.count : 0,
          }))
        : cards.map((vm) => ({
            id: vm.id,
            lead: vm.bank ? <BrandMark name={vm.bank} color={vm.color} size={40} logo={bankLogoForName(vm.bank)} /> : <Tile tone={vm.color}><CreditCard /></Tile>,
            title: vm.last4 ? `${vm.bank} ••${vm.last4}` : vm.bank,
            sub: [vm.due ? c.statementDue(formatLocalized(parseISO(vm.due), 'MMM d', locale)) : '', vm.utilPct != null ? c.usedPct(vm.utilPct) : ''].filter(Boolean).join(' · '),
            amount: vm.outstanding,
            currency: vm.currency,
          }))

  return (
    <section>
      <div className="mb-2 flex items-center px-1">
        <h2 className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{c.active}</h2>
        <span className="ms-2 font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{rows.length}</span>
        <Button variant="ghost" size="touch" onClick={onAdd} className="ms-auto px-1 font-semibold text-[var(--color-brand-primary-ink)]">
          <Plus aria-hidden />
          {c.add}
        </Button>
      </div>
      {rows.length > 0 ? (
        <Card padding="none" divide className="overflow-hidden">
          {rows.map((row) => <DebtListRow key={row.id} row={row} onOpen={() => onOpen(row.id)} />)}
        </Card>
      ) : null}
    </section>
  )
}
