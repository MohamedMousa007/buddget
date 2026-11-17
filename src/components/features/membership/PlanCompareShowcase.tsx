import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PlanCompareRow } from './PlanCompare'
import s from './membership.module.css'

export interface PlanCompareShowcaseProps {
  /** The centred head above the columns; leave out to draw the columns alone. */
  head?: { pill?: ReactNode; title: ReactNode; subtitle?: ReactNode }
  /** Column titles: "Free" and "Pro". */
  freeTitle: string
  proTitle: string
  /** The quiet word beside the Free title: "Now". */
  nowLabel?: string
  /** One row per difference; the same shape `PlanCompare` takes. */
  rows: readonly PlanCompareRow[]
  /** "SMS tracking stays free on every account." */
  footnote?: ReactNode
  className?: string
}

/**
 * Free's showcase: what you have beside what Pro adds, with the Pro column raised and outlined. `PlanCompare` is the three-column
 * table of the same rows; this is the two-card form the Plan and billing page leads with.
 */
export function PlanCompareShowcase({ head, freeTitle, proTitle, nowLabel, rows, footnote, className }: PlanCompareShowcaseProps) {
  return (
    <div className={cn(s.showcase, className)}>
      {head ? (
        <div className={s.scHead}>
          {head.pill ? <Badge tone="brand" size="sm" bordered={false}>{head.pill}</Badge> : null}
          <h3 dir="auto">{head.title}</h3>
          {head.subtitle ? <p dir="auto" className={s.sub}>{head.subtitle}</p> : null}
        </div>
      ) : null}
      <div className={s.duo}>
        <div className={s.col} data-plan="free">
          <h4><span dir="auto">{freeTitle}</span>{nowLabel ? <span dir="auto" className={s.now}>{nowLabel}</span> : null}</h4>
          {rows.map((r) => <div key={r.label} className={s.feat}><span dir="auto">{r.label}</span><b dir="auto">{r.free}</b></div>)}
        </div>
        <div className={cn(s.col, s.colPro)} data-plan="pro">
          <h4><span dir="auto">{proTitle}</span></h4>
          {rows.map((r) => <div key={r.label} className={s.feat}><span dir="auto">{r.label}</span><b dir="auto">{r.pro}</b></div>)}
        </div>
      </div>
      {footnote ? <p dir="auto" className={s.fine}>{footnote}</p> : null}
    </div>
  )
}
