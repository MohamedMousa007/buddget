import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import s from './cards.module.css'

/** The wordmark as it is printed on a card. A brand name: never translated, always left to right. */
export function Wordmark() {
  return <span dir="ltr" className={s.wm}>bud<b>d</b>get</span>
}

/** A ticked list on a card back. */
export function CardTicks({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className={s.blist}>
      {items.map((x, i) => <li key={i}><span dir="auto">{x}</span></li>)}
    </ul>
  )
}

/** The two-ended mono line along the bottom of a card back. */
export function CardBillLine({ start, end }: { start: ReactNode; end: ReactNode }) {
  return (
    <div className={s.bill}>
      <span dir="auto">{start}</span>
      <span dir="auto">{end}</span>
    </div>
  )
}

export interface CardFact { label: string; value: ReactNode; /** The invite code's wider, heavier setting. */ code?: boolean }

/** Three small label/value pairs along a card's bottom edge; the last one sits at the end. */
export function CardFacts({ facts }: { facts: readonly [CardFact, CardFact, CardFact] }) {
  return (
    <div className={s.cfacts}>
      {facts.map((f, i) => (
        <div key={i}>
          <span dir="auto">{f.label}</span>
          <b dir="ltr" className={cn(f.code && s.code)}>{f.value}</b>
        </div>
      ))}
    </div>
  )
}

/** A Latin-only font (the script signature) cannot set this name: use the app font instead. */
export const needsAppFont = (name: string): boolean => /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(name)
