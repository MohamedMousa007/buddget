'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBudgetCloseCopy } from './useCloseCopy'

/** Plan-page prompt that appears once the cycle before this one has finished. */
export function MonthCloseCard({ month, onOpen }: { month: string; onOpen: () => void }) {
  const c = useBudgetCloseCopy().card
  return (
    <Card padding="md" className="flex items-center gap-3">
      <BuddgyIcon mood="idle" size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.title(month)}</p>
        <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.body}</p>
      </div>
      <Button size="touch" onClick={onOpen}>
        {c.cta}
      </Button>
    </Card>
  )
}
