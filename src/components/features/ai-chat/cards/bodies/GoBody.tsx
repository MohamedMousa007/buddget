'use client'

import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { Line } from './parts'

/** Go there: the link chip is the action. It only reaches a card when moving needs a yes (BDG-015). */
export function GoBody({ preview, onGo }: { preview: PreviewModel; onGo: () => void }) {
  const copy = useBuddgyCardCopy()
  const target = preview.rows[0]?.value ?? preview.title
  return (
    <>
      <Button variant="outline" size="touch" className="self-start" onClick={onGo}>
        <ArrowUpRight aria-hidden />
        {copy.open(target)}
      </Button>
      {preview.effect ? <Line>{preview.effect}</Line> : null}
    </>
  )
}
