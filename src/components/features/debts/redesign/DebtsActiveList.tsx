'use client'

import type { ReactNode } from 'react'
import { parseISO } from 'date-fns'
import { CalendarClock, ChevronRight, CreditCard, HandCoins, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import { ProviderBadge } from './ProviderBadge'

interface RowModel {
  id: string
  lead: ReactNode
  title: string
  /** The provider beside an installment's item name. */
  badge?: string
  amount: number
  currency: string
  owed?: boolean
  line2: string
  line3: string
  /** 0–100 for the bar. */
  pct: number
  barTone: string
  planLine?: string
}

const BRAND = 'var(--color-brand-primary)'

function Tile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[11px] [&_svg]:size-5" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
      {children}
    </span>
  )
}

const clampPct = (n: number) => Math.round(Math.min(100, Math.max(0, n)))

/** One active debt (round 9 `rowA`): logo, name, what is left, one meta line, then the bar. */
function DebtListRow({ row, onOpen }: { row: RowModel; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-[84px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">
      {row.lead}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span dir="auto" className="min-w-0 truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{row.title}</span>
            {row.badge ? <Badge tone="soft" className="h-5 shrink-0 rounded-md px-1.5 text-[0.6875rem] font-semibold">{row.badge}</Badge> : null}
          </span>
          <span className="shrink-0 whitespace-nowrap font-mono-numbers text-[0.9375rem] font-semibold tabular-nums" style={{ color: row.owed ? 'var(--color-brand-green)' : 'var(--color-brand-text-primary)' }}>
            {row.owed ? '+' : ''}{formatFlex(row.amount)} <span className="text-[0.6875rem] font-normal text-[var(--color-brand-text-muted)]">{row.currency}</span>
          </span>
        </span>
        <span className="mt-0.5 flex items-baseline gap-2 text-xs text-[var(--color-brand-text-muted)]">
          <span dir="auto" className="min-w-0 flex-1 truncate">{row.line2}</span>
          {row.line3 ? <span className="shrink-0 font-mono-numbers">{row.line3}</span> : null}
        </span>
        <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
          <span className="block h-full rounded-full" style={{ width: `${row.pct}%`, background: row.barTone }} />
        </span>
        {row.planLine ? (
          <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-snug text-[var(--color-brand-text-secondary)]">
            <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0">{row.planLine}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

function SectionHead({ title, count, right }: { title: string; count: number; right?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-11 items-center px-1">
      <h2 className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
      <span className="ms-2 font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{count}</span>
      {right ? <span className="ms-auto flex items-center gap-1">{right}</span> : null}
    </div>
  )
}

function Rows({ rows, onOpen }: { rows: RowModel[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return null
  return (
    <Card padding="none" divide className="overflow-hidden">
      {rows.map((row) => <DebtListRow key={row.id} row={row} onOpen={() => onOpen(row.id)} />)}
    </Card>
  )
}

const Note = ({ children }: { children: ReactNode }) => <p className="mx-1 mt-2 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{children}</p>

/** The Debts list for one tab (round 9): what you owe with its total and Add; Borrow adds Owed to you; card plans sit under their card. */
export function DebtsActiveList({ family, borrow, installments, cards, onAdd, onOpen }: {
  family: DebtFamily
  borrow: BorrowVM[]
  installments: InstallmentVM[]
  cards: CreditCardVM[]
  onAdd: () => void
  onOpen: (id: string) => void
}) {
  const lt = useDebtsSubsLtCopy().debts
  const c = useDebtsV9Copy().list
  const { locale } = useLocale()

  const borrowRow = (vm: BorrowVM): RowModel => {
    const owed = vm.dir === 'owed'
    const unit = vm.gold ? 'g' : vm.currency
    const due = vm.goal?.next ? (owed ? c.expected(vm.goal.next) : c.due(vm.goal.next)) : c.noDue
    return {
      id: vm.id,
      lead: <Tile tone={owed ? 'var(--color-brand-green)' : 'var(--color-brand-amber)'}><HandCoins /></Tile>,
      title: vm.name,
      amount: vm.remaining,
      currency: unit,
      owed,
      line2: vm.goal ? `${lt.perMonth(formatWhole(vm.goal.per))} · ${due}` : due,
      line3: owed ? c.backOf(formatFlex(vm.paid), formatFlex(vm.total)) : c.paidOf(formatFlex(vm.paid), formatFlex(vm.total)),
      pct: vm.total > 0 ? clampPct((vm.paid / vm.total) * 100) : 0,
      barTone: owed ? 'var(--color-brand-green)' : BRAND,
    }
  }
  const planRow = (vm: InstallmentVM): RowModel => ({
    id: vm.id,
    lead: <ProviderBadge slug={vm.logoSlug} name={vm.providerName} size={40} />,
    title: vm.item || vm.providerName,
    badge: vm.item ? vm.providerName : undefined,
    amount: vm.remaining,
    currency: vm.currency,
    line2: [lt.perMonth(formatWhole(vm.per)), vm.overdueDays > 0 ? lt.late(vm.overdueDays) : vm.next ? c.due(vm.next) : ''].filter(Boolean).join(' · '),
    line3: c.leftOfN(Math.max(0, vm.count - vm.paid), vm.count),
    pct: vm.count > 0 ? clampPct((vm.paid / vm.count) * 100) : 0,
    barTone: BRAND,
  })
  const cardRow = (vm: CreditCardVM): RowModel => {
    const pct = vm.utilPct ?? 0
    return {
      id: vm.id,
      lead: vm.bank ? <BrandMark name={vm.bank} color={vm.color} size={40} logo={bankLogoForName(vm.bank)} /> : <Tile tone={vm.color}><CreditCard /></Tile>,
      title: vm.last4 ? `${vm.bank} ••${vm.last4}` : vm.bank,
      amount: vm.outstanding,
      currency: vm.currency,
      line2: vm.due ? lt.statementDue(formatLocalized(parseISO(vm.due), 'MMM d', locale)) : '',
      line3: vm.limit ? c.pctOfLimit(pct, formatWhole(vm.limit)) : '',
      pct: clampPct(pct),
      barTone: pct >= 80 ? 'var(--color-brand-red)' : pct >= 50 ? 'var(--color-brand-amber)' : BRAND,
      planLine: vm.plans ? c.planLine(vm.plans.n, formatWhole(vm.plans.monthly), formatWhole(vm.plans.left)) : undefined,
    }
  }

  const add = (
    <Button variant="ghost" size="touch" onClick={onAdd} className="px-1 font-semibold text-[var(--color-brand-primary-ink)]">
      <Plus aria-hidden />
      {lt.add}
    </Button>
  )
  const total = (rows: RowModel[]) => <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{formatWhole(rows.reduce((s, r) => s + r.amount, 0))}</span>

  if (family === 'borrow') {
    const owe = borrow.filter((b) => b.dir === 'owe').map(borrowRow)
    const owed = borrow.filter((b) => b.dir === 'owed').map(borrowRow)
    return (
      <>
        <section>
          <SectionHead title={c.youOwe} count={owe.length} right={<>{total(owe)}{add}</>} />
          <Rows rows={owe} onOpen={onOpen} />
        </section>
        {owed.length ? (
          <section className="mt-4">
            <SectionHead
              title={c.owedToYou}
              count={owed.length}
              right={<span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-green)]">+{formatWhole(owed.reduce((s, r) => s + r.amount, 0))}</span>}
            />
            <Rows rows={owed} onOpen={onOpen} />
            <Note>{c.owedNote}</Note>
          </section>
        ) : null}
      </>
    )
  }

  if (family === 'installment') {
    const rows = installments.filter((p) => !p.onCardId).map(planRow)
    const onCards = cards.filter((k) => k.plans)
    return (
      <section>
        <SectionHead title={c.plans} count={rows.length} right={<>{total(rows)}{add}</>} />
        <Rows rows={rows} onOpen={onOpen} />
        {onCards.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onOpen(k.id)}
            className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--color-brand-border-strong)] px-4 py-3 text-start"
          >
            {k.bank ? <BrandMark name={k.bank} color={k.color} size={40} logo={bankLogoForName(k.bank)} /> : <Tile tone={k.color}><CreditCard /></Tile>}
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.plansOnCard(k.plans!.n, k.bank)}</span>
              <span className="block truncate font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{c.plansSub(formatWhole(k.plans!.monthly), formatWhole(k.plans!.left))}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
          </button>
        ))}
        {onCards.length ? <Note>{c.plansNote}</Note> : null}
      </section>
    )
  }

  const rows = cards.map(cardRow)
  return (
    <section>
      <SectionHead title={c.cards} count={rows.length} right={<>{total(rows)}{add}</>} />
      <Rows rows={rows} onOpen={onOpen} />
      {rows.length ? <Note>{c.cardsNote}</Note> : null}
    </section>
  )
}
