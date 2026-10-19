'use client'

import { Info } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { CurrencyMark } from '@/components/ui/CurrencyMark'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { convertCurrency } from '@/lib/utils/currency'
import type { Currency } from '@/lib/store/types'

interface Props {
  from: Currency
  to: Currency | null
  rates: Record<string, number>
  noRate: boolean
  onConfirm: () => void
  onCancel: () => void
}

const SAMPLE = 1250

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2))

/** Asks before the main currency changes, and says exactly what that does (see `planBaseCurrencySwitch`). */
export function BaseCurrencyChangeSheet({ from, to, rates, noRate, onConfirm, onCancel }: Props) {
  const copy = useSettingsHubCopy().currency
  const target = to ?? from
  const sample = `${fmt(SAMPLE)} ${from} → ${fmt(convertCurrency(SAMPLE, from, target, rates))} ${target}`

  return (
    <ModalShell open={to !== null} onBackdropClick={onCancel} zIndexClassName="z-[120]" panelClassName="md:w-[420px]" padContent>
      <div className="flex flex-col gap-4 pb-1">
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-brand-sunken)] text-sm font-bold text-[var(--color-brand-text-secondary)]">
            <CurrencyMark code={from} />
          </span>
          <span aria-hidden className="font-mono-numbers font-bold text-[var(--color-brand-text-muted)]">→</span>
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-bold text-[var(--color-brand-primary-ink)]">
            <CurrencyMark code={target} />
          </span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">{copy.sheetTitle(target)}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-text-muted)]">{copy.body(target)}</p>
        </div>
        {noRate ? (
          <p role="alert" className="rounded-xl bg-[var(--color-brand-primary-soft)] p-3 text-[13px] font-medium text-[var(--color-brand-text-primary)]">
            {copy.noRate}
          </p>
        ) : (
          <>
            <p className="font-mono-numbers rounded-xl bg-[var(--color-brand-elevated)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-brand-text-primary)]">
              {sample}
            </p>
            <p className="flex gap-2.5 rounded-xl bg-[var(--color-brand-primary-soft)] p-3 text-[13px] leading-snug text-[var(--color-brand-primary-ink)]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{copy.note(from)}</span>
            </p>
          </>
        )}
        <div className="grid gap-2.5">
          {noRate ? null : (
            <Button size="cta" onClick={onConfirm}>{copy.confirm(target)}</Button>
          )}
          <Button size="cta" variant="outline" onClick={onCancel}>{copy.keep(from)}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
