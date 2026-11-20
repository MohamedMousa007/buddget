'use client'

import type { ReactNode } from 'react'
import { ArrowRight, ChevronDown, Info } from 'lucide-react'
import { FactsTable } from '@/components/ui/FactsTable'
import type { PreviewRow } from '@/lib/buddgy/tools/proposal'
import { formatFixed2 } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

/** The amount drawn large, currency beside it, the description under it. */
export function AmountHero({ amount, currency, what }: { amount: number; currency?: string; what?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span dir="ltr" className="flex items-baseline gap-1.5 self-start">
        <span className="font-mono-numbers text-[2.125rem] font-semibold leading-tight tracking-tight">{formatFixed2(amount)}</span>
        {currency ? <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-secondary)]">{currency}</span> : null}
      </span>
      {what ? <span dir="auto" className="text-[var(--color-brand-text-secondary)]">{what}</span> : null}
    </div>
  )
}

/** The amber "what this does" line under a change. */
export function EffectLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[var(--color-brand-amber-soft)] px-3 py-2.5 text-[0.8125rem] font-semibold text-[var(--color-brand-amber)]">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span dir="auto">{children}</span>
    </p>
  )
}

/** A quiet sentence: a consequence or a status line. */
export function Line({ children }: { children: ReactNode }) {
  return <p dir="auto" className="text-[var(--color-brand-text-secondary)]">{children}</p>
}

/** Forward arrow that points the reading direction. */
export function Forward({ className }: { className?: string }) {
  return <ArrowRight aria-hidden className={cn('size-3.5 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180', className)} />
}

export function Facts({ rows }: { rows: PreviewRow[] }) {
  if (rows.length === 0) return null
  return <FactsTable rows={rows.map((r) => ({ label: r.label, value: r.value, sub: r.before ? <s className="opacity-70">{r.before}</s> : undefined }))} />
}

/** One fact that opens its picker in place: label, value, an optional "guessed", a chevron. */
export function PickerLine({ label, value, aria, open, guessed, onToggle, children }: {
  label: string
  value: ReactNode
  aria: string
  open: boolean
  guessed?: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-t border-[var(--color-brand-border)]">
      <button
        type="button"
        data-raw-button-ok="a fact line in a Buddgy card that opens its picker in place"
        aria-label={aria}
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center gap-2.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]"
      >
        <span className="w-[84px] shrink-0 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{label}</span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold">{value}</span>
        {guessed ? <span className="text-xs text-[var(--color-brand-text-muted)]">{guessed}</span> : null}
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-[var(--color-brand-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </div>
  )
}
