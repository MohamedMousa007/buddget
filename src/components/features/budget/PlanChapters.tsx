'use client'

import type { BudgetChapter } from '@/lib/budget/blocks'
import type { LineAction } from '@/lib/budget/lineStatus'
import type { LineView, PlanMode, PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { BLOCK_BODIES } from './blocks'
import { BlockShell } from './BlockShell'
import { ChapterCard } from './ChapterCard'

export interface PlanChaptersProps {
  view: PlanView
  mode: PlanMode
  collapsed: ReadonlySet<BudgetChapter>
  onToggle: (chapter: BudgetChapter) => void
  onOpenLine: (lineId: string) => void
  onLineAction: (line: LineView, action: LineAction) => void
  onAdd: (block: BudgetBlock) => void
  onOpenLinked: (block: BudgetBlock) => void
}

/** The three chapters of seven blocks, shared by the Budget page and the read-only past-plan view. */
export function PlanChapters({ view, mode, collapsed, onToggle, ...handlers }: PlanChaptersProps) {
  return (
    <>
      {view.chapters.map((chapter, i) => (
        <ChapterCard
          key={chapter.chapter}
          chapter={chapter}
          index={i + 1}
          mode={mode}
          base={view.base}
          expanded={!collapsed.has(chapter.chapter)}
          onToggle={() => onToggle(chapter.chapter)}
        >
          {chapter.blocks.map((block) => {
            const Body = BLOCK_BODIES[block.block]
            return (
              <BlockShell key={block.block} id={`block-${block.block}`} block={block} mode={mode} base={view.base}>
                <Body view={view} block={block} mode={mode} {...handlers} />
              </BlockShell>
            )
          })}
        </ChapterCard>
      ))}
    </>
  )
}
