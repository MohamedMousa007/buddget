'use client'

import { useBudgetBlocksCopy } from '@/components/features/budget/useBlocksCopy'
import type { BlockBodyProps } from '@/components/features/budget/types'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { cycleCloseDate, toIsoDate } from './geometry'
import { AddRow, BodyFrame, FlatCard, LineRow } from './parts'

/** Investing, giving, yearly set-asides and buffer as simple allocation rows. */
export function GrowBlockBody({ view, block, mode, onOpenLine, onLineAction, onAdd }: BlockBodyProps) {
  const t = useBudgetBlocksCopy()
  const { formatDayMonth } = useLocalizedFormatters()
  const close = formatDayMonth(toIsoDate(cycleCloseDate(new Date(), view.dayOfCycle, view.daysInCycle)))

  return (
    <BodyFrame>
      <FlatCard divide>
        {block.lines.map((lv) => (
          <LineRow
            key={lv.line.id}
            view={view}
            lv={lv}
            mode={mode}
            sub={mode === 'month' && !lv.paid ? t.grow.scheduledOn(close) : undefined}
            onOpen={() => onOpenLine(lv.line.id)}
            onAction={(a) => onLineAction(lv, a)}
          />
        ))}
        <AddRow label={t.grow.add} onClick={() => onAdd('grow')} />
      </FlatCard>
    </BodyFrame>
  )
}
