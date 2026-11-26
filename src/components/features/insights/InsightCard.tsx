'use client'

import type { ReactNode } from 'react'
import { Emphasis, ToneTile, UnlockButton, type Tone } from './InsightsParts'

export interface InsightCardProps {
  /** The finding's kind, so Buddgy can scroll to it. */
  id: string
  icon: ReactNode
  tone: Tone
  /** The sentence; `*like this*` marks the figures. */
  headline: string
  why: string
  /** Free users on a Pro finding: the sentence stays, the figures are hidden. */
  locked?: boolean
  askLabel: string
  onAsk: () => void
  onUnlock: () => void
}

/**
 * One finding as a row of the "What changed" list. Readable rows open Buddgy with the finding as the question;
 * locked rows keep their sentence with •••• in place of the figures and "Unlock with Pro" in place of the detail.
 */
export function InsightCard({ id, icon, tone, headline, why, locked = false, askLabel, onAsk, onUnlock }: InsightCardProps) {
  const readable = (
    <>
      <ToneTile tone={tone}>{icon}</ToneTile>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)] [&_b]:font-mono-numbers">
          <Emphasis text={headline} />
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-brand-text-muted)]">{why}</span>
      </span>
    </>
  )
  return (
    <li className="scroll-mt-4" data-insight-id={id} data-insight-locked={locked || undefined}>
      {locked ? (
        <div className="flex items-start gap-3 px-4 pb-1 pt-3">
          <ToneTile tone={tone}>{icon}</ToneTile>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold leading-snug text-[var(--color-brand-text-primary)]">
              <Emphasis text={headline} locked />
            </span>
            <UnlockButton onClick={onUnlock} />
          </span>
        </div>
      ) : (
        <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-start active:bg-[var(--color-brand-elevated)]" aria-label={`${askLabel}: ${headline.replace(/\*/g, '')}`} onClick={onAsk}>
          {readable}
        </button>
      )}
    </li>
  )
}
