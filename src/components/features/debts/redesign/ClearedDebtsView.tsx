'use client'

import { Check, ChevronLeft, ChevronRight, CreditCard, HandCoins, Smartphone, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BAND_FG2, HeroBand } from '@/components/features/hero/HeroBand'
import type { ClearedVM } from '@/hooks/useDebtTabData'
import type { DebtFamily } from '@/lib/debts/debtFamily'
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatWhole } from '@/lib/utils/formatters'

const LEAD: Record<DebtFamily, { Icon: typeof HandCoins; tone: string }> = {
  borrow: { Icon: HandCoins, tone: 'var(--color-brand-amber)' },
  installment: { Icon: Smartphone, tone: 'var(--color-brand-primary)' },
  credit_card: { Icon: CreditCard, tone: 'var(--color-brand-green)' },
}

export interface NextToClear {
  id: string
  name: string
  paymentsLeft: number
  pct: number
}

/** Cleared debts (round 9): a page with a back row, the trophy band, the cleared list newest first, and the debt closest to done. */
export function ClearedDebtsView({ cleared, base, next, onBack, onOpen }: {
  cleared: ClearedVM[]
  base: string
  next: NextToClear | null
  onBack: () => void
  onOpen: (id: string) => void
}) {
  const c = useDebtsV9Copy().cleared
  const hidden = useMask('hero')
  const total = cleared.reduce((s, x) => s + x.original, 0)
  const months = cleared.reduce((s, x) => s + x.months, 0)
  const fastest = cleared.length ? Math.min(...cleared.map((x) => x.months)) : 0

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center">
        <Button variant="ghost" size="touch" onClick={onBack} className="-ms-2 px-2 text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
          <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
          {c.back}
        </Button>
      </div>
      <h1 className="px-1 text-[1.375rem] font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.title}</h1>
      <HeroBand
        contained
        label={c.heroLabel}
        aside={<Trophy className="size-[18px] text-[var(--flow-band-fg)]" aria-hidden />}
        numbers={
          <>
            <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{cleared.length}</span>
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b className="block font-mono-numbers text-[1.0625rem] text-[var(--flow-band-fg)]">{hidden ? MASK : formatWhole(total)}</b>
              {c.paidOff(base)}
            </p>
          </>
        }
        cells={[
          { label: c.months, value: String(months) },
          { label: c.fastest, value: c.monthsShort(fastest) },
          { label: c.last, value: cleared[0]?.clearedMonth ?? '—' },
        ]}
      />
      <h2 className={`${microClassName} mt-2.5 px-1`}>{c.head}</h2>
      <Card padding="none" divide className="overflow-hidden">
        {cleared.map((x) => {
          const { Icon, tone } = LEAD[x.family]
          return (
            <button key={x.id} type="button" onClick={() => onOpen(x.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start hover:bg-[var(--color-brand-elevated)]">
              <span className="relative shrink-0">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-[11px] [&_svg]:size-5" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}><Icon /></span>
                <span aria-hidden className="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]"><Check className="size-3" /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{x.name}</span>
                <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{c.rowSub(c.kind[x.family], x.clearedMonth, x.months)}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono-numbers text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">
                {formatWhole(x.original)} <span className="text-[0.6875rem] font-normal text-[var(--color-brand-text-muted)]">{x.currency}</span>
              </span>
            </button>
          )
        })}
      </Card>
      {next ? (
        <button type="button" onClick={() => onOpen(next.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-start">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-[var(--color-brand-primary-ink)]">{c.nextToClear}</span>
            <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{c.paymentsLeft(next.name, next.paymentsLeft)}</span>
            <span aria-hidden className="mt-1.5 block h-1.5 rounded-full bg-[var(--color-brand-sunken)]">
              <span className="block h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${next.pct}%` }} />
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
