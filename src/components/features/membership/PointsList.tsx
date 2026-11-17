import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

/** The card these pages group rows in: card surface, hairline border, 20px corners. */
export function MembershipPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(s.panel, className)}>{children}</div>
}

export interface PointsRow {
  label: ReactNode
  /** A second, smaller line under the label: "Within 48 hours, keeps your streak". */
  hint?: ReactNode
  /** "+10", "120 pts", or a few words: set in mono, in teal. */
  value: ReactNode
}

/** Earn rows, spend rows and invite milestones: what you do at the start, what it is worth at the end. */
export function PointsList({ rows, className }: { rows: readonly PointsRow[]; className?: string }) {
  return (
    <MembershipPanel className={className}>
      <div className={s.rows}>
        {rows.map((r, i) => (
          <div key={i} className={s.row}>
            <span dir="auto" className={s.rowLabel}>{r.label}{r.hint ? <small>{r.hint}</small> : null}</span>
            <b dir="auto" className={s.rowValue}>{r.value}</b>
          </div>
        ))}
      </div>
    </MembershipPanel>
  )
}

/** "How it works": numbered steps in a panel. */
export function StepsList({ steps, className }: { steps: readonly ReactNode[]; className?: string }) {
  return (
    <MembershipPanel className={className}>
      <ol className={cn(s.rows, 'm-0 list-none p-0')}>
        {steps.map((step, i) => (
          <li key={i} className={cn(s.row, s.stepRow)}>
            <b dir="ltr" className={s.stepNum} aria-hidden>{i + 1}</b>
            <span dir="auto">{step}</span>
          </li>
        ))}
      </ol>
    </MembershipPanel>
  )
}
