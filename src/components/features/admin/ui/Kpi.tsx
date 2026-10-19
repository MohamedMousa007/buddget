'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { StatTile } from '@/components/ui/StatTile'
import { Pill } from './Pill'

/** Percentage change as a small pill. `inverse` flips good/bad for metrics where lower is better. */
export function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0 && current === 0) return <Pill><Minus className="size-3" aria-hidden />0%</Pill>
  if (previous === 0) return <Pill tone="brand">new</Pill>
  const change = ((current - previous) / previous) * 100
  const up = change > 0
  const good = inverse ? !up : up
  return (
    <Pill tone={change === 0 ? 'neutral' : good ? 'good' : 'bad'}>
      {up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
      {Math.abs(change).toFixed(0)}%
    </Pill>
  )
}

/** The app's `StatTile`, laid out as a responsive KPI row. */
export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const grid = cols === 5 ? 'xl:grid-cols-5' : cols === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
  return <div className={`grid grid-cols-2 gap-3 ${grid}`}>{children}</div>
}

export { StatTile }
