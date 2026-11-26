'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { formatAmount } from '@/components/ui/NumberPad'
import { useNumberPad } from '@/components/ui/useNumberPad'
import { minorUnit } from '@/lib/accounts/balance'
import { balanceDelta } from '@/lib/accounts/balanceEdit'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { HIT_AREA } from '@/lib/ui/hitArea'
import { cn } from '@/lib/utils'
import { moneyFlex, smartSplit, splitMoney } from './accountDisplay'

/** The figure being typed: the pad's digits and whether the ± key is on. */
export interface BalanceDraft {
  value: string
  negative: boolean
  /** A currency picked in the hero look, saved with the balance; unset keeps the account's. */
  currency?: string
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
  onSave: (reported: number, currency?: string) => void
  /** Offer the ± key (a bank account's balance only). */
  allowNegative?: boolean
  /** Under the figure; defaults to "Tap the amount to change it". */
  hint?: ReactNode
  /** Beside the "Balance" caption (Estimate, Overdrawn). */
  badge?: ReactNode
  /** A reason the typed amount cannot be saved (a savings guard); disables Save. */
  refusal?: string | null
  /** `hero` (Light touch account sheet): centred figure, tappable currency, old → new line and an equal Cancel | Set balance pair. */
  look?: 'default' | 'hero'
  /** Hero look: replaces the "Balance" caption ("Cash, an estimate"). */
  caption?: ReactNode
  /** Hero look: the currency opens the built-in CurrencySheet and is saved with the balance. */
  currencyEditable?: boolean
  /** Hero look: the currency opens the caller's own sheet instead (Cash's currency sheet). Wins over `currencyEditable`. */
  onCurrencyClick?: () => void
  /**
   * Hero look: the sheet's footer slot. Given, Cancel | Set balance sit there as the sheet's pinned footer, shown only
   * while the balance or currency differs (null while the slot mounts). Unset keeps the pair under the figure.
   */
  footerTarget?: HTMLElement | null
}

/**
 * Tap the balance to change it: the figure becomes the typed amount with the app's NumberPad under the sheet, a live
 * "+1,250 vs buddget", and one Save that names the result. The caller decides what Save writes.
 */
export function InlineBalanceEdit(props: InlineBalanceEditProps) {
  if (props.look === 'hero') return <HeroBalanceEdit {...props} />
  return <ClassicBalanceEdit {...props} />
}

function ClassicBalanceEdit({ current, currency, masked, draft, onDraftChange, reported, onSave, allowNegative = false, hint, badge, refusal }: InlineBalanceEditProps) {
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

const HERO_DIGITS = 'truncate font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums'
const HERO_UNIT = 'font-mono-numbers text-[1.625rem] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-muted)]'

/** The Light touch look: the balance centred like `AmountHero`, its currency tappable, and the correction spelled out. */
function HeroBalanceEdit({ current, currency, masked, draft, onDraftChange, reported, onSave, allowNegative = false, hint, badge, refusal, caption, currencyEditable, onCurrencyClick, footerTarget }: InlineBalanceEditProps) {
  const all = useT()
  const t = all.accountsPage
  const c = useAccountsLtCopy().account
  const lt = useLightTouchCopy()
  const [curOpen, setCurOpen] = useState(false)
  const neg = !!draft?.negative && allowNegative
  const cur = draft?.currency ?? currency
  const { isOpen: padOpen, openPad, closePad, pad } = useNumberPad({
    value: draft?.value ?? '',
    onChange: (value) => onDraftChange({ ...draft, value, negative: neg }),
    currency: cur,
    label: current === null ? t.balanceToday : t.newBalance,
    allowNegative,
    negative: neg,
    onNegativeChange: (negative) => onDraftChange({ ...draft, value: draft?.value ?? '', negative }),
  })
  const has = current !== null
  const startDraft = () => onDraftChange({ value: '', negative: false })
  const pickCurrency = (code: string) => {
    setCurOpen(false)
    if (code === currency && !draft) return
    // A new currency keeps the figure, so the line reads "120,425 EGP → 120,425 USD" until the amount is typed too.
    const kept = has ? Math.round(Math.abs(current) * minorUnit(currency)) / minorUnit(currency) : null
    onDraftChange({ value: draft?.value || (kept !== null ? String(kept) : ''), negative: draft?.negative ?? (has && current < 0), currency: code })
  }
  const openCurrency = onCurrencyClick ?? (currencyEditable ? () => setCurOpen(true) : undefined)
  const unit = openCurrency ? (
    <button type="button" data-raw-button-ok="the inline currency after the balance, as AmountHero's" onClick={openCurrency} aria-label={lt.amountHero.currency(cur)}
      className={cn(HIT_AREA, 'inline-flex items-center gap-0.5 hover:text-[var(--color-brand-text-secondary)]', HERO_UNIT)}>
      <span dir="ltr">{cur}</span><ChevronDown className="size-[18px] translate-y-px" aria-hidden />
    </button>
  ) : <span dir="ltr" className={HERO_UNIT}>{cur}</span>

  const shownDigits = draft
    ? `${neg ? '\u2212' : ''}${formatAmount(draft.value) || '0'}`
    : masked ? MASK : has ? (() => { const s = smartSplit(current, currency); return s.int + s.dec })() : '0'
  const curChanged = cur !== currency
  const diff = draft && reported !== null && has && !curChanged ? balanceDelta(current, reported, currency) : 0
  const dirty = draft !== null && (reported !== null && (!has || curChanged || diff !== 0))
  const fmt = (n: number, code: string) => `${moneyFlex(n, code)} ${code}`
  const pinned = footerTarget !== undefined

  // With the pinned footer hidden until something differs, an untouched draft would leave no Cancel: the pad closing drops it.
  useEffect(() => {
    if (pinned && has && draft && !dirty && !padOpen) onDraftChange(null)
  }, [pinned, has, draft, dirty, padOpen, onDraftChange])

  const line = !draft
    ? (hint ?? c.hint)
    : !has
      ? <span className="font-semibold text-[var(--color-brand-primary-ink)]">{t.startsToday}</span>
      : dirty && reported !== null
        ? (
          <>
            <span className="font-semibold text-[var(--color-brand-amber)]">
              <s className="font-normal text-[var(--color-brand-text-muted)]">{masked ? MASK : fmt(current, currency)}</s>
              {' \u2192 '}{fmt(reported, cur)}{diff ? ` \u00b7 ${diff > 0 ? '+' : '\u2212'}${moneyFlex(Math.abs(diff), currency)}` : ''}
            </span>
            <span className="block text-xs text-[var(--color-brand-text-muted)]">{c.correction}</span>
          </>
        )
        : reported !== null ? <span className="font-semibold text-[var(--color-brand-green)]">{t.matchesBuddget}</span> : (hint ?? c.hint)

  const cancel = () => { closePad(); onDraftChange(null) }
  const save = () => {
    if (reported === null || refusal) return
    closePad()
    onSave(reported, curChanged ? cur : undefined)
    onDraftChange(null)
  }

  const actions = (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button variant="outline" size="cta-block" onClick={cancel}>{all.common.cancel}</Button>
      <Button size="cta-block" className="font-semibold" disabled={reported === null || !!refusal} onClick={save}>{t.setBalance}</Button>
    </div>
  )

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]">{draft && has ? t.newBalance : (caption ?? t.balance)}</span>
        {neg ? <Badge variant="warning">{t.overdrawn}</Badge> : draft ? null : badge}
      </div>
      <div dir="ltr" className="mt-1.5 flex max-w-full items-baseline justify-center gap-1.5">
        <button type="button" data-raw-button-ok="the balance figure itself is the edit control"
          aria-live={draft ? 'polite' : undefined}
          aria-label={`${t.balance} ${masked && !draft ? '' : shownDigits} ${cur}. ${t.tapToChange}`}
          onClick={(e) => { if (!draft) startDraft(); openPad(e) }}
          className={cn('-mx-1 flex min-h-12 min-w-0 items-baseline rounded-xl px-1 transition-[background-color] duration-150 active:bg-[var(--color-brand-sunken)]',
            neg || (!draft && has && current < 0) ? 'text-[var(--color-brand-red)]' : draft && !draft.value ? 'text-[var(--color-brand-text-muted)]' : 'text-[var(--color-brand-text-primary)]')}>
          <span className={HERO_DIGITS}>{shownDigits}</span>
          {draft ? <span aria-hidden className="ms-0.5 h-8 w-0.5 self-center animate-pulse rounded-full bg-[var(--color-brand-primary)] motion-reduce:animate-none" /> : null}
        </button>
        {unit}
      </div>
      <p dir="auto" className="mt-2 min-h-5 text-[0.8125rem] text-[var(--color-brand-text-secondary)] [text-wrap:pretty]">{line}</p>
      {refusal ? <p role="alert" className="mt-1 text-[0.8125rem] text-[var(--color-brand-amber)]">{refusal}</p> : null}
      {draft && !pinned ? <div className="mt-4 w-full">{actions}</div> : null}
      {pinned && footerTarget && dirty ? createPortal(
        <div className="border-t border-[var(--color-brand-border)]"><SheetFooter safeArea>{actions}</SheetFooter></div>,
        footerTarget,
      ) : null}
      {pad}
      {currencyEditable && !onCurrencyClick ? (
        <CurrencySheet open={curOpen} value={cur} onSelect={pickCurrency} onClose={() => setCurOpen(false)} zIndexClassName="z-[120]" />
      ) : null}
    </div>
  )
}
