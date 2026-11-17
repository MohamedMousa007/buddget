'use client'

import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

export interface SparksPackOption {
  id: string
  /** Sparks in the pack before any bonus. */
  sparks: number
  /** The store's price string. */
  price: string
  /** A small caption above the amount: "Egypt". */
  tag?: string
  /** The bonus Sparks the server will add, when it is known. Otherwise it is worked out from `bonusPercent`. */
  bonus?: number
}

/** Bonus Sparks on a pack: Pro +15%, loyal Pro +20%, Free 0. Rounded to the nearest Spark, as the design shows (650 gives 98). */
export const packBonusSparks = (sparks: number, percent: number): number => (percent > 0 ? Math.round((sparks * percent) / 100) : 0)

/** What the buyer receives: the pack plus its bonus. */
export const packTotalSparks = (pack: Pick<SparksPackOption, 'sparks' | 'bonus'>, percent: number): number => pack.sparks + (pack.bonus ?? packBonusSparks(pack.sparks, percent))

/** The line under a pack's amount: the bonus when there is one, the plain unit when there is not. */
export function packNote(pack: Pick<SparksPackOption, 'sparks' | 'bonus'>, percent: number, copy: { plain: string; bonus: (sparks: number) => string }): string {
  const bonus = pack.bonus ?? packBonusSparks(pack.sparks, percent)
  return bonus > 0 ? copy.bonus(bonus) : copy.plain
}

export interface SparksPacksProps {
  /** The three packs always shown. */
  packs: readonly SparksPackOption[]
  /** Packs under "More packs" (the two Egypt-only sizes). */
  extraPacks?: readonly SparksPackOption[]
  selected: string | null
  onSelect: (id: string) => void
  /** The pack that carries the gold tag. */
  popularId?: string
  /** 0 for Free, 15 for Pro, 20 for a loyal Pro. */
  bonusPercent: number
  copy: {
    /** Accessible name of the choice: "Sparks packs". */
    group: string
    /** "Most popular". */
    popular: string
    /** "Sparks": under the amount when there is no bonus. */
    plain: string
    /** "+98 Pro bonus". */
    bonus: (sparks: number) => string
    more: string
    fewer: string
  }
  /** The buy button under the packs: "Get 748 Sparks". */
  cta?: { label: ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }
  /** Free: the tinted line that sells the Pro bonus, with its link ("With Pro, this pack is 748 Sparks" · "See Pro"). */
  upsell?: { text: ReactNode; actionLabel: string; onAction: () => void }
  /** Pro: the fine print about bonuses. */
  finePrint?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Sparks packs inline, where you run out: three packs in a row with the gold "Most popular", the smaller packs behind "More packs",
 * the buy button and the bonus line. `SparksPackPicker` is the stacked list for a sheet; this is the Usage page's wallet.
 */
export function SparksPacks({ packs, extraPacks = [], selected, onSelect, popularId, bonusPercent, copy, cta, upsell, finePrint, disabled, className }: SparksPacksProps) {
  // A selected pack is never hidden: choosing an extra pack keeps the drawer open.
  const [open, setOpen] = useState(() => extraPacks.some((p) => p.id === selected))
  const extraId = useId()
  const pack = (p: SparksPackOption) => (
    <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} disabled={disabled} onClick={() => onSelect(p.id)} className={s.pack} data-pack={p.id} data-raw-button-ok="a pack tile: amount, bonus and price stacked, with the gold tag on its top edge">
      {p.id === popularId ? <span dir="auto" className={s.best}>{copy.popular}</span> : null}
      {p.tag ? <span dir="auto" className={s.eg}>{p.tag}</span> : null}
      <b dir="ltr">{p.sparks}</b>
      <small dir="auto">{packNote(p, bonusPercent, copy)}</small>
      <em dir="ltr">{p.price}</em>
    </button>
  )
  return (
    <div className={cn(s.packsWrap, className)}>
      <div role="radiogroup" aria-label={copy.group} className={s.packsWrap}>
        <div className={s.packs}>{packs.map(pack)}</div>
        {open ? <div id={extraId} className={cn(s.packs, s.packsExtra)}>{extraPacks.map(pack)}</div> : null}
      </div>
      {extraPacks.length ? (
        <div className={s.morePacks}>
          <button type="button" aria-expanded={open} aria-controls={open ? extraId : undefined} onClick={() => setOpen((v) => !v)} className={s.moreBtn}>{open ? copy.fewer : copy.more}</button>
        </div>
      ) : null}
      {cta ? <Button size="cta-block" onClick={cta.onClick} disabled={cta.disabled || disabled} loading={cta.loading}>{cta.label}</Button> : null}
      {upsell ? (
        <div className={s.bonus}>
          <span dir="auto">{upsell.text}</span>
          <button type="button" onClick={upsell.onAction} className={s.bonusLink}>{upsell.actionLabel}</button>
        </div>
      ) : null}
      {finePrint ? <p dir="auto" className={s.fine}>{finePrint}</p> : null}
    </div>
  )
}
