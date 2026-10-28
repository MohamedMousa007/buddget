'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { HeroBand, type HeroBandCell } from '@/components/features/hero/HeroBand'
import { BuddgyHead, stepLead } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboardingCopy } from './useOnboardingCopy'

export interface RevealScreenProps {
  chrome: StepChrome
  label: string
  chip: string
  big: string
  unit: string
  bar: ReactNode
  cells: [HeroBandCell, HeroBandCell, HeroBandCell]
  title: string
  lead: string
  /** Extra block under the lead (a list of accounts, a hint about what comes next). */
  extra?: ReactNode
  onContinue: () => void
}

/** The payoff screens: a real number in the hero band, Buddgy saying what it means, then on. */
export function RevealScreen({ chrome, label, chip, big, unit, bar, cells, title, lead, extra, onContinue }: RevealScreenProps) {
  const c = useOnboardingCopy()
  return (
    <JourneyFrame
      {...chrome}
      bleed={
        <HeroBand
          label={label}
          aside={<span className="inline-flex h-[22px] items-center rounded-full bg-[var(--flow-band-mix)] px-2.5 text-[11px] font-bold">{chip}</span>}
          numbers={
            <p className="flex items-baseline gap-1.5">
              <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{big}</span>
              <span className="text-[13px] text-[var(--flow-band-fg-2)]">{unit}</span>
            </p>
          }
          bar={bar}
          cells={cells}
        />
      }
      footer={
        <Button size="cta" className="w-full" onClick={onContinue}>
          {c.cont}
        </Button>
      }
    >
      <div className="mt-3 flex items-start gap-3">
        <BuddgyHead mood="done" size={48} />
        <h1 className="min-w-0 flex-1 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-balance text-[var(--color-brand-text-primary)]">{title}</h1>
      </div>
      <p className={stepLead}>{lead}</p>
      {extra}
    </JourneyFrame>
  )
}

/** A thin segmented bar in the band's colours; `parts` are shares that add up to roughly 1. */
export function BandBar({ parts }: { parts: Array<{ share: number; color: string }> }) {
  return (
    <div className="flex h-1.5 gap-px overflow-hidden rounded-full" style={{ background: 'var(--flow-band-mix)' }} aria-hidden>
      {parts.map((p, i) => (
        <span key={i} className="block h-full" style={{ width: `${Math.max(2, Math.round(p.share * 100))}%`, background: p.color }} />
      ))}
    </div>
  )
}
