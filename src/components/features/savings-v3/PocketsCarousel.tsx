'use client'

import { useRef, useState } from 'react'
import type { SavingsAccount } from '@/lib/store/types'
import { PocketCard } from '@/components/features/savings-v3/PocketCard'

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
  onMenu: (id: string) => void
}

export function PocketsCarousel({ pockets, onAdd, onWithdraw, onMenu }: PocketsCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const onScroll = () => {
    const rail = railRef.current
    if (!rail) return
    // card width 343 + gap 12
    const i = Math.round(rail.scrollLeft / (343 + 12))
    if (i !== active) setActive(Math.max(0, Math.min(i, pockets.length - 1)))
  }

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        className="flex overflow-x-auto no-scrollbar"
        style={{ gap: 12, padding: '10px 16px 6px', scrollSnapType: 'x mandatory' }}
      >
        {pockets.map((p) => (
          <PocketCard
            key={p.account.id}
            account={p.account}
            coverAmount={p.coverAmount}
            goalsAmount={p.goalsAmount}
            goalLabel={p.goalLabel}
            isAuto={p.isAuto}
            onAdd={() => onAdd(p.account.id)}
            onWithdraw={() => onWithdraw(p.account.id)}
            onMenu={() => onMenu(p.account.id)}
          />
        ))}
      </div>
      {pockets.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {pockets.map((p, i) => (
            <span
              key={p.account.id}
              style={{
                height: 5, width: i === active ? 16 : 5, borderRadius: 999,
                background: i === active ? '#E50914' : 'var(--color-brand-border)',
                transition: 'width .2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
