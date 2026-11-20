import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import s from './membership.module.css'

/** One week on the strip. `current` is this week, kept; `pending` is this week, not kept yet; `missed` is an empty cell. */
export type StreakWeek = 'kept' | 'frozen' | 'missed' | 'current' | 'pending'

export const STREAK_STRIP_WEEKS = 12

/** The strip always shows 12 cells, newest last: older weeks fall off the start, a short history is padded with empty cells. */
export function streakCells(weeks: readonly StreakWeek[], length = STREAK_STRIP_WEEKS): StreakWeek[] {
  const tail = weeks.slice(-length)
  return [...Array<StreakWeek>(length - tail.length).fill('missed'), ...tail]
}

/** What a cell draws: lit, frozen, ringed as this week, and which glyph it carries. */
export function streakCellLook(week: StreakWeek): { lit: boolean; frozen: boolean; now: boolean; glyph: 'flame' | 'snow' | null } {
  return {
    lit: week === 'kept' || week === 'current',
    frozen: week === 'frozen',
    now: week === 'current' || week === 'pending',
    glyph: week === 'kept' || week === 'current' ? 'flame' : week === 'frozen' ? 'snow' : null,
  }
}

/** The streak flame: the one filled glyph in the set, lit from ember to gold. */
function Flame() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff8a2a" />
          <stop offset=".55" stopColor="#f5b13c" />
          <stop offset="1" stopColor="#f5d98a" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2c.6 3.2-1.4 4.9-2.8 6.6C7.7 10.4 6.5 12.1 6.5 14.5A5.5 5.5 0 0 0 12 20a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.1-3.7-2-4.8-.2 1.4-.9 2.5-2 3 .4-2.9-.3-6.6-1.5-10.7z" />
    </svg>
  )
}

function Snow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
    </svg>
  )
}

export interface HotStreakCardProps {
  /** "6-week streak": wrap the number in <b> to set it in mono. */
  title: ReactNode
  /** "Your best is 9 weeks". */
  subtitle?: ReactNode
  /** "+300", in gold. */
  points: string
  /** "points this streak". */
  pointsLabel: string
  /** Oldest first; the last entry is this week. */
  weeks: readonly StreakWeek[]
  /** Accessible summary of the strip: "Last 12 weeks: 10 kept, 1 frozen, 1 missed". */
  stripLabel: string
  /** "Next bonus at 8 weeks · +100": <b> marks the emphasis. */
  footStart?: ReactNode
  /** "2 freezes left". */
  footEnd?: ReactNode
  className?: string
}

/** The hot streak: the flame, twelve weeks with kept, frozen and this-week cells, the next bonus and the freezes left. */
export function HotStreakCard({ title, subtitle, points, pointsLabel, weeks, stripLabel, footStart, footEnd, className }: HotStreakCardProps) {
  return (
    <div className={cn(s.hot, className)}>
      <div className={s.hotTop}>
        <span className={s.flame}><Flame /></span>
        <div>
          <h3 dir="auto">{title}</h3>
          {subtitle ? <p dir="auto">{subtitle}</p> : null}
        </div>
        <div className={s.pts}><b dir="ltr">{points}</b><span dir="auto">{pointsLabel}</span></div>
      </div>
      <div className={s.wk} role="img" aria-label={stripLabel}>
        {streakCells(weeks).map((w, i) => {
          const look = streakCellLook(w)
          return (
            <span key={i} data-week={w} className={cn(look.lit && s.wkOn, look.frozen && s.wkFz, look.now && s.wkNow)}>
              {look.glyph === 'flame' ? <Flame /> : look.glyph === 'snow' ? <Snow /> : null}
            </span>
          )
        })}
      </div>
      {footStart || footEnd ? <div className={s.foot}><span dir="auto">{footStart}</span><span dir="auto">{footEnd}</span></div> : null}
    </div>
  )
}
