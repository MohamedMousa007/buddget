import type { ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardFace, FlipCardRig } from './FlipCardRig'
import { CardBillLine, CardTicks, Wordmark, needsAppFont } from './cardParts'
import { signatureFontClass } from './signatureFont'
import s from './cards.module.css'

export interface FounderSignatureFrontProps {
  /** "FOUNDER". */
  mark: string
  /** The founder number, formatted: "#023". */
  number: string
  /** Signed in the script face; a name the script cannot set (Arabic) uses the app font. */
  name: string
  /** "Your number". */
  numberLabel: string
  /** The line of thanks. */
  thanks: ReactNode
}

export function FounderSignatureFront({ mark, number, name, numberLabel, thanks }: FounderSignatureFrontProps) {
  const plain = needsAppFont(name)
  return (
    <CardFace finish="founder">
      <div className={s.cin}>
        <div className={s.fcTop}>
          <span className={s.fcMark}><Crown aria-hidden strokeWidth={1.8} /><span dir="auto">{mark}</span></span>
          <span dir="ltr" className={s.fcNum}>{number}</span>
        </div>
        <div dir="auto" className={cn(s.fcSig, plain ? s.fcSigPlain : signatureFontClass)} data-signature={plain ? 'plain' : 'script'}>{name}</div>
        <div className={s.fcBot}>
          <div><span dir="auto">{numberLabel}</span><b dir="ltr">{number}</b></div>
          <p dir="auto">{thanks}</p>
        </div>
      </div>
    </CardFace>
  )
}

export interface FounderSignatureBackProps {
  /** "FOUNDERS CLUB". */
  mark: string
  perks: readonly ReactNode[]
  /** "Joined 17 Nov 2026" at the start, "Yours for good" at the end. */
  footer: readonly [ReactNode, ReactNode]
}

export function FounderSignatureBack({ mark, perks, footer }: FounderSignatureBackProps) {
  return (
    <CardFace finish="founder">
      <div className={s.cin}>
        <div className={s.fcTop}>
          <span className={s.fcMark}><Crown aria-hidden strokeWidth={1.8} /><span dir="auto">{mark}</span></span>
          <Wordmark />
        </div>
        <CardTicks items={perks} />
        <CardBillLine start={footer[0]} end={footer[1]} />
      </div>
    </CardFace>
  )
}

export interface FounderSignatureCardProps {
  front: FounderSignatureFrontProps
  back: FounderSignatureBackProps
  flipLabel: string
  onFlip?: (flipped: boolean) => void
  className?: string
}

/** The founder's card on the flip rig: black, a gold hairline, the number, and the name as a signature. */
export function FounderSignatureCard({ front, back, flipLabel, onFlip, className }: FounderSignatureCardProps) {
  return <FlipCardRig label={flipLabel} onFlip={onFlip} className={className} front={<FounderSignatureFront {...front} />} back={<FounderSignatureBack {...back} />} />
}
