'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { SavingsAccount } from '@/lib/store/types'
import { PocketCard } from '@/components/features/savings-v3/PocketCard'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'

export interface PocketVM {
  account: SavingsAccount
  coverAmount: number
  goalsAmount: number
  goalLabel: string
  isAuto: boolean
}

export interface PocketsCarouselProps {
  pockets: PocketVM[]
  onAdd: (id: string) => void
  onWithdraw: (id: string) => void
  onMenu: (id: string, anchor: DOMRect) => void
  /** Trailing "add pocket" tile — opens the new-pocket flow. */
  onAddPocket: () => void
}

/** Same one-card-per-swipe carousel as Income/Debts (item 2) — the trailing
 *  "add pocket" tile is a full slide too, not a small peek tile. */
export function PocketsCarousel({ pockets, onAdd, onWithdraw, onMenu, onAddPocket }: PocketsCarouselProps) {
  const [active, setActive] = useState(0)
  const count = pockets.length + 1

  return (
    <div className="px-4 pt-2.5 pb-1.5">
      <RecurringIncomeCarousel
        count={count}
        activeIndex={Math.min(active, count - 1)}
        onActiveChange={setActive}
        renderItem={(i) => {
          const p = pockets[i]
          if (!p) {
            return (
              <button
                type="button" onClick={onAddPocket} aria-label="Add a pocket"
                className="flex w-full flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)]"
                style={{ minHeight: 214 }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-brand-border)]"><Plus size={18} /></span>
                <span className="text-xs font-semibold">Add pocket</span>
              </button>
            )
          }
          return (
            <PocketCard
              account={p.account}
              coverAmount={p.coverAmount}
              goalsAmount={p.goalsAmount}
              goalLabel={p.goalLabel}
              isAuto={p.isAuto}
              fullWidth
              onAdd={() => onAdd(p.account.id)}
              onWithdraw={() => onWithdraw(p.account.id)}
              onMenu={(rect) => onMenu(p.account.id, rect)}
            />
          )
        }}
      />
    </div>
  )
}
