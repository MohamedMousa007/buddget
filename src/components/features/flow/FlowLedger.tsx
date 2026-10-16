'use client'

import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { TransactionRow, type TransactionRowProps } from '@/components/transactions/TransactionRow'

export interface FlowLedgerRow {
  key: string
  /** Money in: gets the 3px green edge marker. */
  isIn?: boolean
  /** Highlighted as the current selection (payday history). */
  selected?: boolean
  row: TransactionRowProps
  /** Absent = not swipeable (pending captures, payday history). */
  swipe?: {
    onDelete: () => void
    deleteLabel: string
    rightAction?: { label: string; icon: ReactNode; onAction: () => void }
  }
}

export interface FlowLedgerGroup {
  key: string
  /** "Today", "Yesterday" or the weekday. Absent: no header (a single list, e.g. payday history). */
  label?: string
  /** Short date, mono — "Sep 28". */
  date?: string
  /** Signed day net, pre-formatted — excludes refunded, declined and pending rows. */
  net?: string
  rows: FlowLedgerRow[]
}

/**
 * Day-grouped transaction list for Flow and Paydays history: a day header, then the rows on
 * a card surface with hairlines inset 82px (past the icon column). Rows are TransactionRow
 * unchanged — late / refunded / declined / pending ride on its titleBadge, subtitle,
 * amountColor and dimmed. The ledger cross-fades (120 ms) when its content changes.
 */
export function FlowLedger({ groups, fadeKey }: { groups: FlowLedgerGroup[]; fadeKey?: string }) {
  const [open, setOpen] = useState<{ key: string; side: SwipeSide } | null>(null)
  return (
    <motion.div
      key={fadeKey}
      className="mt-0.5 lg:mx-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      {groups.map((g) => (
        <DayGroup key={g.key} group={g} open={open} setOpen={setOpen} />
      ))}
    </motion.div>
  )
}

export function DayGroup({
  group,
  open,
  setOpen,
}: {
  group: FlowLedgerGroup
  open: { key: string; side: SwipeSide } | null
  setOpen: (v: { key: string; side: SwipeSide } | null) => void
}) {
  return (
    <section className="lg:mb-3">
      {group.label ? (
      <div className="flex items-baseline justify-between px-4 pb-1.5 pt-3">
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-[var(--color-brand-text-primary)]">{group.label}</span>
          {group.date ? (
            <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{group.date}</span>
          ) : null}
        </span>
        {group.net ? (
          <span className="font-mono-numbers text-[12.5px] font-semibold tabular-nums text-[var(--color-brand-text-secondary)]">
            {group.net}
          </span>
        ) : null}
      </div>
      ) : null}
      <div className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)] lg:overflow-hidden lg:rounded-2xl lg:border">
        {group.rows.map((r, i) => {
          const row = <TransactionRow {...r.row} />
          return (
            <div
              key={r.key}
              className={r.selected ? 'relative bg-[var(--color-brand-primary-soft)]' : 'relative'}
              aria-current={r.selected || undefined}
            >
              {r.selected ? (
                <span aria-hidden className="absolute inset-y-0 start-0 z-[2] w-[3px] bg-[var(--color-brand-primary)]" />
              ) : null}
              {i > 0 ? <div className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
              {r.isIn ? (
                <span
                  aria-hidden
                  className="absolute inset-y-2.5 start-0 z-[2] w-[3px] rounded-e-[3px] bg-[var(--color-brand-green)]"
                />
              ) : null}
              {r.swipe ? (
                <SwipeToDelete
                  openSide={open?.key === r.key ? open.side : null}
                  onOpenChange={(side) => setOpen(side ? { key: r.key, side } : null)}
                  onDelete={() => {
                    setOpen(null)
                    r.swipe!.onDelete()
                  }}
                  deleteLabel={r.swipe.deleteLabel}
                  rightAction={r.swipe.rightAction}
                >
                  {row}
                </SwipeToDelete>
              ) : (
                row
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
