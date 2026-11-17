import type { ReactNode } from 'react'
import { CardFace, FlipCardRig } from './FlipCardRig'
import { CardBillLine, CardFacts, CardTicks, Wordmark, type CardFact } from './cardParts'
import { TierBadge } from './TierBadge'
import type { TierKey } from './tiers'
import s from './cards.module.css'

export interface ProMemberCardFrontProps {
  /** The gold mark: "PRO" or "PRO TRIAL". */
  mark: string
  name: string
  /** The member's tier: its badge follows the name. */
  tier?: TierKey
  tierLabel?: string
  /** "Pro Yearly · Billed by the App Store" / "30-day trial · No card on file". */
  planLine: ReactNode
  /** Member since, renews or trial ends, member number. Values are set in mono, left to right. */
  facts: readonly [CardFact, CardFact, CardFact]
}

/** Front of the Pro card: obsidian in dark, pearl in light, one gold hairline, a blind "b". */
export function ProMemberCardFront({ mark, name, tier, tierLabel, planLine, facts }: ProMemberCardFrontProps) {
  return (
    <CardFace finish="obsidian">
      <div className={s.grain} />
      <div className={s.monogram} aria-hidden>b</div>
      <div className={s.cin}>
        <div className={s.chead}><Wordmark /><span dir="auto" className={s.goldmark}>{mark}</span></div>
        <div className={s.cname}>
          <strong dir="auto">{name}{tier ? <TierBadge tier={tier} size={20} label={tierLabel} /> : null}</strong>
          <span dir="auto">{planLine}</span>
        </div>
        <CardFacts facts={facts} />
      </div>
    </CardFace>
  )
}

export interface ProMemberCardBackProps {
  /** The gold mark on the back: "INCLUDED". */
  mark: string
  /** What Pro includes, up to four short lines. */
  included: readonly ReactNode[]
  /** The billing line: price at the start, next charge at the end. */
  billing: readonly [ReactNode, ReactNode]
}

export function ProMemberCardBack({ mark, included, billing }: ProMemberCardBackProps) {
  return (
    <CardFace finish="obsidian">
      <div className={s.grain} />
      <div className={s.cin}>
        <div className={s.chead}><span dir="auto" className={s.goldmark}>{mark}</span><Wordmark /></div>
        <CardTicks items={included} />
        <CardBillLine start={billing[0]} end={billing[1]} />
      </div>
    </CardFace>
  )
}

export interface ProMemberCardProps {
  front: ProMemberCardFrontProps
  back: ProMemberCardBackProps
  /** Accessible name of the flip control. */
  flipLabel: string
  onFlip?: (flipped: boolean) => void
  className?: string
}

/** The Pro membership card on the flip rig. Wrap it in `CardSpotlight` on a page. */
export function ProMemberCard({ front, back, flipLabel, onFlip, className }: ProMemberCardProps) {
  return <FlipCardRig label={flipLabel} onFlip={onFlip} className={className} front={<ProMemberCardFront {...front} />} back={<ProMemberCardBack {...back} />} />
}
