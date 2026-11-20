'use client'

import { Badge } from '@/components/ui/badge'
import type { Proposal } from '@/lib/buddgy/tools/proposal'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { Facts, Forward, Line } from './parts'

/** One-tap status: the item, its state now → after as badges, and one line on what it means. */
export function StatusBody({ proposal }: { proposal: Proposal }) {
  const states = useBuddgyCardCopy().status[proposal.tool]
  const { preview } = proposal
  return (
    <>
      <Facts rows={preview.rows} />
      {states ? (
        <div className="flex items-center gap-2">
          <Badge tone={states.fromTone}>{states.from}</Badge>
          <Forward />
          <Badge tone={states.toTone}>{states.to}</Badge>
        </div>
      ) : null}
      {preview.effect ? <Line>{preview.effect}</Line> : null}
    </>
  )
}
