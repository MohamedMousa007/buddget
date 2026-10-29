'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Badge } from '@/components/ui/badge'
import { usePlanView } from '@/hooks/usePlanView'
import type { BudgetChapter } from '@/lib/budget/blocks'
import { FlowStrip } from '../FlowStrip'
import { PlanChapters } from '../PlanChapters'
import { useBudgetDeckCopy } from '../useDeckCopy'

const noop = () => {}

function PastPlanBody({ planId, onClose }: { planId: string; onClose: () => void }) {
  const view = usePlanView('plan', planId)
  const c = useBudgetDeckCopy().history
  const [collapsed, setCollapsed] = useState<ReadonlySet<BudgetChapter>>(new Set())
  if (!view) return null
  return (
    <div className="flex flex-col gap-4 pb-6">
      <V3SheetHeader title={view.plan.name} onClose={onClose} />
      <Badge variant="muted" className="self-start">{c.readOnly}</Badge>
      {/* Read only: inert blocks every tap, and Button-component calls to action are hidden. */}
      <div inert className="flex flex-col gap-4 [&_.group\/button]:hidden">
        <FlowStrip view={view} onFix={noop} onJump={noop} />
        <PlanChapters
          view={view}
          mode="plan"
          collapsed={collapsed}
          onToggle={(ch) =>
            setCollapsed((prev) => {
              const next = new Set(prev)
              if (!next.delete(ch)) next.add(ch)
              return next
            })
          }
          onOpenLine={noop}
          onLineAction={noop}
          onAdd={noop}
          onOpenLinked={noop}
        />
      </div>
    </div>
  )
}

/** A past (or any) plan exactly as it was, with nothing editable. */
export function PastPlanSheet({ planId, onClose }: { planId: string | null; onClose: () => void }) {
  return (
    <ModalShell open={planId != null} onBackdropClick={onClose} padContent>
      {planId ? <PastPlanBody key={planId} planId={planId} onClose={onClose} /> : null}
    </ModalShell>
  )
}
