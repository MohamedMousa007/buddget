import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CardFace, FlipCardRig } from './FlipCardRig'
import { CardBillLine, CardFacts, CardTicks, Wordmark, type CardFact } from './cardParts'
import s from './cards.module.css'

export interface GuestPassCardFrontProps {
  /** The gold mark: "GUEST PASS". */
  mark: string
  /** "37 days of Pro, on Layla". */
  title: ReactNode
  /** "No card needed · For a new buddget account". */
  subtitle: ReactNode
  /** Invite code (give it `code: true`), what the friend gets, what you get. */
  facts: readonly [CardFact, CardFact, CardFact]
}

export function GuestPassCardFront({ mark, title, subtitle, facts }: GuestPassCardFrontProps) {
  return (
    <CardFace finish="obsidian">
      <div className={s.grain} />
      <div className={s.monogram} aria-hidden>b</div>
      <div className={s.cin}>
        <div className={s.chead}><Wordmark /><span dir="auto" className={s.goldmark}>{mark}</span></div>
        <div className={cn(s.cname, s.cnameGift)}>
          <strong dir="auto">{title}</strong>
          <span dir="auto">{subtitle}</span>
        </div>
        <CardFacts facts={facts} />
      </div>
    </CardFace>
  )
}

export interface GuestPassCardBackProps {
  /** "WHAT THEY GET". */
  mark: string
  benefits: readonly ReactNode[]
  /** "Code LAYLA-7K2" at the start, "No card, no charge" at the end. */
  footer: readonly [ReactNode, ReactNode]
}

export function GuestPassCardBack({ mark, benefits, footer }: GuestPassCardBackProps) {
  return (
    <CardFace finish="obsidian">
      <div className={s.grain} />
      <div className={s.cin}>
        <div className={s.chead}><span dir="auto" className={s.goldmark}>{mark}</span><Wordmark /></div>
        <CardTicks items={benefits} />
        <CardBillLine start={footer[0]} end={footer[1]} />
      </div>
    </CardFace>
  )
}

export interface GuestPassCardProps {
  front: GuestPassCardFrontProps
  back: GuestPassCardBackProps
  flipLabel: string
  onFlip?: (flipped: boolean) => void
  className?: string
}

/** The invite pass on the flip rig: the Pro card's material, with the code and both rewards on the front. */
export function GuestPassCard({ front, back, flipLabel, onFlip, className }: GuestPassCardProps) {
  return <FlipCardRig label={flipLabel} onFlip={onFlip} className={className} front={<GuestPassCardFront {...front} />} back={<GuestPassCardBack {...back} />} />
}
