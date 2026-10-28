'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { arEG, enUS } from 'date-fns/locale'
import { Minus, Plus, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useLocale, useT } from '@/lib/i18n'
import { PAY_CYCLE_MAX_DAY, PAY_CYCLE_MIN_DAY, currentCycle } from '@/lib/settings/payCycle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** Where the budget month starts. It belongs with paydays: it is the day the salary lands. */
export function PayCycleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useLocale()
  const c = useT().inlineCopy.payCycle
  const day = useFinanceStore((s) => s.settings.monthStartDay)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const cycle = useMemo(() => currentCycle(new Date(), day), [day])
  const fmt = (d: Date) => format(d, 'd MMM', { locale: locale === 'ar' ? arEG : enUS })
  const set = (next: number) => updateSettings({ monthStartDay: next })
  const wrap = (n: number) => (n < PAY_CYCLE_MIN_DAY ? PAY_CYCLE_MAX_DAY : n > PAY_CYCLE_MAX_DAY ? PAY_CYCLE_MIN_DAY : n)
  const pct = Math.round((cycle.elapsedDays / cycle.totalDays) * 100)

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[440px]" padContent>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{c.title}</h2>
          <IconButton onClick={onClose} aria-label={c.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{c.question}</p>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{c.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton aria-label={c.earlier} variant="outlined" size="md" onClick={() => set(wrap(day - 1))}><Minus /></IconButton>
            <span aria-live="polite" className="font-mono-numbers min-w-12 text-center text-3xl font-bold text-[var(--color-brand-text-primary)]">{day}</span>
            <IconButton aria-label={c.later} variant="outlined" size="md" onClick={() => set(wrap(day + 1))}><Plus /></IconButton>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{c.current}</p>
          <Progress value={pct} aria-label={c.current}>
            <ProgressTrack className="h-2.5"><ProgressIndicator className="bg-[var(--color-brand-primary)]" /></ProgressTrack>
          </Progress>
          <div className="font-mono-numbers mt-2 flex justify-between text-sm font-semibold text-[var(--color-brand-text-primary)]">
            <span>{fmt(cycle.start)}</span>
            <span className="font-sans text-xs font-medium text-[var(--color-brand-text-muted)]">{c.today} · {cycle.elapsedDays}/{cycle.totalDays}</span>
            <span>{fmt(cycle.end)}</span>
          </div>
        </div>
        <p className="rounded-xl bg-[var(--color-brand-primary-soft)] p-3 text-[13px] leading-snug text-[var(--color-brand-primary-ink)]">{c.note}</p>
      </div>
    </ModalShell>
  )
}
