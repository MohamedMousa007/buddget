'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Badge } from '@/components/ui/badge'
import { usePlanView } from '@/hooks/usePlanView'
import type { BudgetBlock } from '@/lib/store/types'
import { FlowStrip } from '../FlowStrip'
import { LedgerList } from '../LedgerList'
import { SegmentPage } from '../SegmentPage'
import { useBudgetDeckCopy } from '../useDeckCopy'

const noop = () => {}

function PastPlanBody({ planId, onClose }: { planId: string; onClose: () => void }) {
  const view = usePlanView('plan', planId)
  const c = useBudgetDeckCopy().history
  const [segment, setSegment] = useState<BudgetBlock | null>(null)
  if (!view) return null
  return (
    <div className="flex flex-col gap-4 pb-6">
      <V3SheetHeader title={view.plan.name} onClose={onClose} />
      <Badge variant="muted" className="self-start">{c.readOnly}</Badge>
      {segment ? (
        <SegmentPage view={view} block={segment} readOnly onBack={() => setSegment(null)} onSelect={setSegment} onOpenLine={noop} onAdd={noop} />
      ) : (
        <>
          <FlowStrip view={view} variant="hero" />
          <LedgerList view={view} onOpen={setSegment} />
        </>
      )}
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
