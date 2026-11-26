'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { Award, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import type { ClearedVM } from '@/hooks/useDebtTabData'
import { cn } from '@/lib/utils'
import { formatWhole } from '@/lib/utils/formatters'
import { useLocale } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'

/** The dashed, tilted green seal of a cleared debt. */
function Seal({ big, children }: { big?: boolean; children: React.ReactNode }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-brand-green)] text-[var(--color-brand-green)]', big ? 'size-11 [&_svg]:size-5' : 'size-9 [&_svg]:size-4')}>
      {children}
    </span>
  )
}

/** Cleared debts (Light touch `s_vault`): a green "paid off so far" hero, then two columns of seal cards that open to "How you paid". */
export function ClearedVaultSheet({ open, onClose, cleared, base }: { open: boolean; onClose: () => void; cleared: ClearedVM[]; base: string }) {
  const c = useDebtsSubsLtCopy().vault
  const { locale } = useLocale()
  const [openId, setOpenId] = useState<string | null>(null)
  const sum = cleared.reduce((s, x) => s + x.original, 0)
  const lastMonth = cleared[0]?.clearedMonth && cleared[0].clearedMonth !== '—' ? cleared[0].clearedMonth : ''

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title size="compact">{c.title}</V3SheetHeader.Title>
        </V3SheetHeader>
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div className="rounded-3xl bg-[linear-gradient(150deg,color-mix(in_oklab,var(--color-brand-green)_22%,var(--color-brand-card)),color-mix(in_oklab,var(--color-brand-green)_8%,var(--color-brand-card)))] px-5 pb-5 pt-4">
            <Seal big><Award /></Seal>
            <p className="mt-3 text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]">{c.paidOff}</p>
            <p className="font-mono-numbers text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
              {formatWhole(sum)} <span className="text-sm font-medium text-[var(--color-brand-text-muted)]">{base}</span>
            </p>
            <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.summary(cleared.length, lastMonth)}</p>
          </div>

          {cleared.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{c.empty}</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {cleared.map((x) => {
                const on = openId === x.id
                return (
                  <div key={x.id} className={cn('rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-green)_28%,transparent)] bg-[var(--color-brand-card)] p-3.5', on && 'col-span-2')}>
                    <div className="flex items-start justify-between">
                      <Seal><Check /></Seal>
                      <span className="text-[0.6875rem] font-semibold text-[var(--color-brand-green)]">{c.tag[x.family]}</span>
                    </div>
                    <p dir="auto" className="mt-3 truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{x.name}</p>
                    <p className="font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">
                      {formatWhole(x.original)} <span className="text-[0.6875rem] font-medium text-[var(--color-brand-text-muted)]">{x.currency}</span>
                    </p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{c.clearedIn(x.clearedMonth, x.history.length)}</p>
                    {on ? (
                      <div className="mt-3 border-t border-[var(--color-brand-border)] pt-2">
                        {x.history.map((h, i) => (
                          <div key={i} className="flex justify-between py-1 text-xs text-[var(--color-brand-text-secondary)]">
                            <span dir="auto">{[formatLocalized(parseISO(h.date.slice(0, 10)), 'MMM d', locale), h.method].filter(Boolean).join(' · ')}</span>
                            <span className="font-mono-numbers">−{formatWhole(h.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {x.history.length > 0 ? (
                      <Button variant="ghost" size="touch" onClick={() => setOpenId(on ? null : x.id)} className="mt-1 -ms-2 px-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
                        {on ? c.hide : c.howYouPaid}
                        {on ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
