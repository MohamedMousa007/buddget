'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { useSubsPageLtCopy } from '@/lib/i18n/subsPageLtCopy'
import type { RowGroup } from '@/lib/subscriptions/subscriptionRows'
import { SubscriptionRow } from './SubscriptionRow'

/** The quiet "+ Add" of a section head (as on Debts). */
export function AddSubscriptionLink({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  const c = useSubsPageLtCopy()
  return (
    <Button variant="ghost" size="touch" onClick={onAdd} aria-label={t.subscriptions.addSubscription} className="-my-2 ms-auto px-1 font-semibold text-[var(--color-brand-primary-ink)]">
      <Plus aria-hidden />
      {c.add}
    </Button>
  )
}

/** Light touch `page-subs` sections ("Next 30 days", "Paid this month", …), each a card of rows. The first head carries "+ Add". */
export function SubscriptionGroups({ groups, onOpen, onAdd }: { groups: RowGroup[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const c = useSubsPageLtCopy()
  return (
    <>
      {groups.map((g, i) => (
        <section key={g.key} className="flex flex-col gap-2">
          <div className="flex min-h-6 items-center px-1">
            <h2 className={microClassName}>{c.groups[g.key]}</h2>
            {i === 0 ? <AddSubscriptionLink onAdd={onAdd} /> : null}
          </div>
          <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden">
            {g.rows.map((r) => (
              <SubscriptionRow key={r.sub.id} row={r} paid={g.key === 'paid'} onOpen={() => onOpen(r.sub.id)} />
            ))}
          </Card>
        </section>
      ))}
    </>
  )
}
