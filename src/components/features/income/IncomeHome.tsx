'use client'

import { Check, CalendarCheck, ChevronRight, Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { BandNoteLine, boldIn } from '@/components/features/hero/BandNoteLine'
import { fitBigNumber } from '@/components/features/hero/fitText'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountTitle } from '@/components/features/accounts/accountDisplay'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { usePaydaysLtCopy } from '@/lib/i18n/paydaysLtCopy'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatFlex } from '@/lib/utils/formatters'
import type { IncomeSourceType, PaymentMethod } from '@/lib/store/types'

export interface IncomeHomeRow {
  id: string
  name: string
  type: IncomeSourceType | undefined
  /** The icon picked for an Other source. */
  icon?: string
  amount: number
  currency: string
  /** The account it lands in, for the corner badge. */
  method?: PaymentMethod
  /** "Monthly · next Nov 25" or the cadence alone. */
  line: string
  status: { tone: 'ok' | 'due' | 'soon'; text: string }
}

/** The source mark (round 9 `srcMark`): the type's icon, with the account it lands in as a corner badge. */
export function SourceMark({ type, icon, method, size = 44 }: { type: IncomeSourceType | undefined; icon?: string; method?: PaymentMethod; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span aria-hidden className="flex items-center justify-center rounded-[12px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]" style={{ width: size, height: size }}>
        <IncomeTypeIcon type={type} icon={icon} className="size-5" />
      </span>
      {method ? (
        <span aria-hidden className="absolute -bottom-1 -end-1 flex overflow-hidden rounded-full border-2 border-[var(--color-brand-card)]">
          <BrandMark name={accountTitle(method)} color={accountColor(method)} size={20} logo={bankLogoForName(accountTitle(method))} />
        </span>
      ) : null}
    </span>
  )
}

function Status({ tone, text }: IncomeHomeRow['status']) {
  if (tone === 'ok') return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-[var(--color-brand-green)]"><Check aria-hidden className="size-3.5" />{text}</span>
  if (tone === 'due') return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-[var(--color-brand-primary-ink)]"><CalendarCheck aria-hidden className="size-3.5" />{text}</span>
  return <span className="whitespace-nowrap text-[0.75rem] font-medium text-[var(--color-brand-text-muted)]">{text}</span>
}

/** Income home (round 9, was Paydays): this month received against expected, then every source as a provider-style row. */
export function IncomeHome({ month, base, expected, received, inCount, next, rows, onOpen, onAdd, assign, irregularNote = false }: {
  month: string
  base: string
  expected: number
  received: number
  inCount: number
  next: { name: string; date: string } | null
  rows: IncomeHomeRow[]
  onOpen: (id: string) => void
  onAdd: () => void
  /** Money that arrived and no source claimed yet: the "Assign … from …" row under the hero. */
  assign?: { amount: string; from: string | null; date: string; onOpen: () => void }
  /** Some source is irregular: the note under the list says it is never marked late. */
  irregularNote?: boolean
}) {
  const all = usePaydaysLtCopy()
  const c = all.home
  const hidden = useMask('hero')
  const shown = hidden ? MASK : formatFlex(received)
  const pct = expected > 0 ? Math.min(100, (received / expected) * 100) : 0

  return (
    <>
      <HeroBand
        contained
        label={c.label(month)}
        numbers={
          <>
            <p className="flex min-w-0 items-baseline gap-1.5">
              <span className={`shrink-0 font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${fitBigNumber(shown)}`}>{shown}</span>
              <span className={`min-w-0 truncate text-[0.8125rem] ${BAND_FG2}`}>{c.received(base)}</span>
            </p>
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{hidden ? MASK : formatFlex(expected)}</b>
              {all.expected}
            </p>
          </>
        }
        bar={
          <>
            <div className="h-1.5 rounded-full" style={{ background: BAND_MIX }}>
              <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${pct}%` }} />
            </div>
            <BandScale>
              <span>{c.sourcesIn(inCount, rows.length)}</span>
              <span>{received < expected ? c.toCome(hidden ? MASK : formatFlex(expected - received)) : c.allIn}</span>
            </BandScale>
          </>
        }
        note={next ? <BandNoteLine parts={[boldIn(c.nextOn(next.name, next.date), next.name)]} /> : undefined}
      />

      {assign ? (
        <button data-raw-button-ok="the Assign row card under the Income hero (mockup asgRow)"
          type="button"
          onClick={assign.onOpen}
          className="mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3 text-start transition-transform duration-150 ease-out active:scale-[0.99]"
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]"><Link2 className="size-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.assignRow(assign.amount, assign.from)}</span>
            <span className="block truncate text-xs text-[var(--color-brand-text-secondary)]">{c.assignRowSub(assign.date)}</span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-secondary)] rtl:rotate-180" />
        </button>
      ) : null}

      <section className="mt-5">
        <div className="mb-2 flex min-h-11 items-center px-1">
          <h2 className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{c.head}</h2>
          <span className="ms-2 font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{rows.length}</span>
          <Button variant="ghost" size="touch" onClick={onAdd} className="ms-auto px-1 font-semibold text-[var(--color-brand-primary-ink)]">
            <Plus aria-hidden />
            {c.add}
          </Button>
        </div>
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <button data-raw-button-ok="an income source row card (mockup srcRow)"
              key={r.id}
              type="button"
              onClick={() => onOpen(r.id)}
              className="block w-full rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3.5 text-start transition-transform duration-150 ease-out active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <SourceMark type={r.type} icon={r.icon} method={r.method} />
                <span className="min-w-0 flex-1 ps-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span dir="auto" className="truncate text-base font-bold text-[var(--color-brand-text-primary)]">{r.name}</span>
                    <span className="shrink-0 whitespace-nowrap font-mono-numbers text-base font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
                      {formatFlex(r.amount)} <span className="text-[0.71875rem] font-normal text-[var(--color-brand-text-muted)]">{r.currency}</span>
                    </span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--color-brand-text-muted)]">{r.line}</span>
                    <Status {...r.status} />
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
              </span>
            </button>
          ))}
        </div>
        {irregularNote ? <p className="mt-2.5 px-1 text-xs leading-[1.45] text-[var(--color-brand-text-muted)]">{c.irregularNote}</p> : null}
      </section>
    </>
  )
}
