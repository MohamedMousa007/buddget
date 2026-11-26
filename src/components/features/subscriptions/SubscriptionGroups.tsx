'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { useSubsPageLtCopy } from '@/lib/i18n/subsPageLtCopy'
import { cn } from '@/lib/utils'
import type { RowGroup } from '@/lib/subscriptions/subscriptionRows'
import { SubscriptionRow } from './SubscriptionRow'

/** A quiet "+ Add subscription" text link (the mockup's page has no add control; this is the least visible place). */
export function AddSubscriptionLink({ onAdd, className }: { onAdd: () => void; className?: string }) {
  const t = useT()
  return (
    <Button variant="ghost" size="touch" onClick={onAdd} className={cn('px-1 font-semibold text-[var(--color-brand-primary-ink)]', className)}>
      <Plus aria-hidden />
      {t.subscriptions.addSubscription}
    </Button>
  )
}

/** Light touch `page-subs` sections ("Next 30 days", "Paid this month", …), each a card of rows; a quiet add link after the last. */
export function SubscriptionGroups({ groups, onOpen, onAdd }: { groups: RowGroup[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const c = useSubsPageLtCopy()
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex min-h-6 items-center px-1">
            <h2 className={microClassName}>{c.groups[g.key]}</h2>
          </div>
          <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden">
            {g.rows.map((r) => (
              <SubscriptionRow key={r.sub.id} row={r} paid={g.key === 'paid'} onOpen={() => onOpen(r.sub.id)} />
            ))}
          </Card>
        </section>
      ))}
      <AddSubscriptionLink onAdd={onAdd} className="-mt-1 self-start" />
    </>
  )
}
