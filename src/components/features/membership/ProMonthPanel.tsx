import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

export interface ProMonthTile {
  /** The member's own number this month ("214"). */
  value: string
  /** "Buddgy answers". */
  label: string
  /** Change on last month ("+18%"); left out during a trial. */
  delta?: string
  /** Where the Free limit falls along the member's bar, 0 to 100. */
  freeCapPct: number
  /** "Free stops at ≈30": wrap the figure in <b> to gild it. */
  capLabel: ReactNode
}

export interface ProMonthPanelProps {
  /** "Pro this month" / "So far with Pro". */
  kicker: string
  /** "Pro went 7× further than Free would have": wrap the multiple in <b>. */
  title: ReactNode
  subtitle?: ReactNode
  /** The start label under every bar: "You". */
  youLabel: string
  tiles: readonly ProMonthTile[]
  className?: string
}

/** The value panel: how far Pro carried this member past each Free limit, with the Free cap marked in gold on every bar. */
export function ProMonthPanel({ kicker, title, subtitle, youLabel, tiles, className }: ProMonthPanelProps) {
  return (
    <section className={cn(s.valp, className)}>
      <div className={s.valpHead}>
        <span dir="auto" className={s.valpKicker}>{kicker}</span>
        <h3 dir="auto">{title}</h3>
        {subtitle ? <p dir="auto" className={s.sub}>{subtitle}</p> : null}
      </div>
      <div className={s.valpGrid}>
        {tiles.map((t) => (
          <div key={t.label} className={s.vt}>
            <div className={s.vtTop}><b dir="ltr">{t.value}</b>{t.delta ? <small dir="ltr">{t.delta}</small> : null}</div>
            <span dir="auto" className={s.vtLabel}>{t.label}</span>
            <div className={s.vbar} aria-hidden><i /><u style={{ insetInlineStart: `${Math.min(100, Math.max(0, t.freeCapPct))}%` }} /></div>
            <div className={s.vbarL}><span dir="auto">{youLabel}</span><span dir="auto">{t.capLabel}</span></div>
          </div>
        ))}
      </div>
    </section>
  )
}
