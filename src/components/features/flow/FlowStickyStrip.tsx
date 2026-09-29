'use client'

import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'

export interface FlowStickyStripProps {
  visible: boolean
  /** Big number, mono 16/600. */
  primary: string
  /** Short sub beside it, e.g. "left of 6,500". */
  secondary: string
  /** Up to two mono 12/600 figures on the end side. */
  right: string[]
}

/**
 * The band collapsed: a 52px teal strip tucked under the logo bar once the band's stat row
 * has scrolled away. It sits below the bar in z-order, so it slides out from behind it.
 */
export function FlowStickyStrip({ visible, primary, secondary, right }: FlowStickyStripProps) {
  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+57px)] z-[39] flex h-[52px] items-center justify-between gap-2.5 px-[18px] text-[var(--flow-band-fg)] lg:hidden"
      style={{
        background: FLOW_BAND_BG,
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease-out',
      }}
    >
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="font-mono-numbers text-base font-semibold">{primary}</span>
        <span className="truncate whitespace-nowrap text-xs text-[var(--flow-band-fg-2)]">{secondary}</span>
      </span>
      <span className="flex gap-2.5 whitespace-nowrap font-mono-numbers text-xs font-semibold">
        {right.map((r) => (
          <span key={r}>{r}</span>
        ))}
      </span>
    </div>
  )
}
