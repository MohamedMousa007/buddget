'use client'

import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAmount } from '@/components/ui/NumberPad'
import { useNumberPad } from '@/components/ui/useNumberPad'
import { balanceDelta } from '@/lib/accounts/balanceEdit'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { moneyFlex, splitMoney } from './accountDisplay'

/** The figure being typed: the pad's digits and whether the ± key is on. */
export interface BalanceDraft {
  value: string
  negative: boolean
}

interface InlineBalanceEditProps {
  /** What buddget holds now; null when the account is not tracked yet (the save starts tracking). */
  current: number | null
  currency: string
  masked: boolean
  /** Controlled: null shows the figure, a draft shows the editor. Tapping the figure starts an empty draft. */
  draft: BalanceDraft | null
  onDraftChange: (draft: BalanceDraft | null) => void
  /** The draft as a signed number (the caller applies its own minus rule); null while it is not a number yet. */
  reported: number | null
  onSave: (reported: number) => void
  /** Offer the ± key (a bank account's balance only). */
  allowNegative?: boolean
  /** Under the figure; defaults to "Tap the amount to change it". */
  hint?: ReactNode
  /** Beside the "Balance" caption (Estimate, Overdrawn). */
  badge?: ReactNode
  /** A reason the typed amount cannot be saved (a savings guard); disables Save. */
  refusal?: string | null
}

/**
 * Tap the balance to change it: the figure becomes the typed amount with the app's NumberPad under the sheet, a live
 * "+1,250 vs buddget", and one Save that names the result. The caller decides what Save writes.
 */
export function InlineBalanceEdit({ current, currency, masked, draft, onDraftChange, reported, onSave, allowNegative = false, hint, badge, refusal }: InlineBalanceEditProps) {
  const all = useT()
  const t = all.accountsPage
  const neg = !!draft?.negative && allowNegative
  const { openPad, closePad, pad } = useNumberPad({
    value: draft?.value ?? '',
    onChange: (value) => onDraftChange({ value, negative: neg }),
    currency,
    label: current === null ? t.balanceToday : t.newBalance,
    allowNegative,
    negative: neg,
    onNegativeChange: (negative) => onDraftChange({ value: draft?.value ?? '', negative }),
  })
  const fmt = (n: number) => moneyFlex(n, currency)

  if (!draft) {
    const split = current === null ? null : splitMoney(current, currency)
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{t.balance}</span>
          {badge}
        </div>
        <button type="button" data-raw-button-ok="the balance figure itself is the edit control"
          aria-label={`${t.balance} ${masked || current === null ? '' : fmt(current)} ${currency}. ${t.tapToChange}`}
          onClick={(e) => { onDraftChange({ value: '', negative: false }); openPad(e) }}
          className={cn('group -mx-1 mt-0.5 flex min-h-12 max-w-full items-baseline gap-1.5 rounded-xl px-1 text-start transition-[background-color] duration-150 active:bg-[var(--color-brand-sunken)]',
            current !== null && current < 0 ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]')}>
          <span className="truncate font-mono-numbers text-[36px] font-semibold leading-[1.05] tracking-[-0.04em]">
            {masked ? MASK : split ? <>{split.int}<span className="opacity-45">{split.dec}</span></> : '—'}
          </span>
          <span className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-muted)]">{currency}</span>
          <Pencil aria-hidden className="size-4 shrink-0 self-center text-[var(--color-brand-text-muted)]" />
        </button>
        <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)] [text-wrap:pretty]">{hint ?? t.tapToChange}</p>
      </div>
    )
  }

  const has = current !== null
  const diff = reported === null || !has ? 0 : balanceDelta(current, reported, currency)
  const shown = `${neg ? '−' : ''}${formatAmount(draft.value)}`
  const change = !has
    ? <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.startsToday}</p>
    : reported === null
      ? <p aria-hidden className="invisible text-[0.8125rem]">.</p>
      : <p className={cn('text-[0.8125rem] font-semibold', diff === 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-amber)]')}>
        {diff === 0 ? t.matchesBuddget : t.vsBuddget(`${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`)}
      </p>
  const label = reported === null ? t.enterAmount : has && diff === 0 ? t.looksRight : t.setBalanceTo(fmt(reported))
  const cancel = () => { closePad(); onDraftChange(null) }
  const save = () => {
    if (reported === null || refusal) return
    closePad()
    onSave(reported)
    onDraftChange(null)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{has ? t.newBalance : t.balanceToday}</span>
        {neg ? <Badge variant="warning">{t.overdrawn}</Badge> : null}
      </div>
      <button type="button" data-raw-button-ok="the typed figure reopens the pad" onClick={openPad}
        aria-live="polite" aria-label={`${has ? t.newBalance : t.balanceToday} ${shown} ${currency}`}
        className={cn('-mx-1 flex min-h-12 max-w-full items-baseline gap-1.5 rounded-xl px-1 text-start', neg ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]')}>
        <span className="truncate font-mono-numbers text-[36px] font-semibold leading-[1.05] tracking-[-0.04em]">{shown}</span>
        <span aria-hidden className="h-8 w-0.5 self-center animate-pulse rounded-full bg-[var(--color-brand-primary)] motion-reduce:animate-none" />
        <span className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-muted)]">{currency}</span>
      </button>
      {change}
      {refusal ? <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">{refusal}</p> : null}
      {has ? (
        <p className="text-xs text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{t.buddgetHas(masked ? MASK : fmt(current))} · {t.correctionNote}</p>
      ) : null}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="cta-block" className="flex-1" onClick={cancel}>{all.common.cancel}</Button>
        <Button size="cta-block" className="flex-[2] font-semibold" disabled={reported === null || !!refusal} onClick={save}>{label}</Button>
      </div>
      {pad}
    </div>
  )
}
