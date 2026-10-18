'use client'

import { ChevronRight, Coins, Flag, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'

export interface PlanRow {
  key: 'finish' | 'funding' | 'pocket'
  label: string
  value: string
}

const ICON = { finish: Flag, funding: Repeat, pocket: Coins } as const

/** Three tappable plan rows; each opens its own editor. */
export function PlanCard({ rows, onOpen }: { rows: PlanRow[]; onOpen: (k: PlanRow['key']) => void }) {
  useT()
  return (
    <Card padding="none" divide className="overflow-hidden">
      {rows.map((r) => {
        const Icon = ICON[r.key]
        return (
          <Button
            key={r.key}
            variant="ghost"
            onClick={() => onOpen(r.key)}
            className="h-14 w-full justify-start gap-3 rounded-none px-4 text-start"
          >
            <Icon className="size-5 shrink-0 text-[var(--color-brand-primary-bright)]" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-normal text-[var(--color-brand-text-secondary)]">{r.label}</span>
              <span className="truncate font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.value}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
          </Button>
        )
      })}
    </Card>
  )
}
