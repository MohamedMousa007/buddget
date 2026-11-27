'use client'

import type { ReactNode } from 'react'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { TransactionRow } from '@/components/transactions/TransactionRow'

export interface MonthlySavingRowProps {
  title: string
  subtitle: string
  /** "placed / leftover", or what was overspent. */
  amount: ReactNode
  /** Placed of leftover, 0–100; absent = no bar (no month end yet). */
  progress?: number
  onOpen: () => void
}

/** The Monthly saving row on Savings (final-ui v9): its own card under the actions; opens the month-end sheet. */
export function MonthlySavingRow({ title, subtitle, amount, progress, onOpen }: MonthlySavingRowProps) {
  return (
    <section className="px-4 lg:px-0">
      <Card padding="none" className="overflow-hidden rounded-2xl">
        <TransactionRow
          icon={<CalendarCheck className="size-5" aria-hidden />}
          iconBg="color-mix(in oklab, var(--color-brand-primary) 16%, transparent)"
          iconFg="var(--color-brand-primary)"
          title={title}
          subtitle={
            <span className="flex min-w-0 flex-col gap-1.5">
              {progress != null ? (
                <Progress value={Math.min(100, progress)} aria-hidden>
                  <ProgressTrack className="h-1 bg-[var(--color-brand-elevated)]">
                    <ProgressIndicator className="bg-[var(--color-brand-primary)]" />
                  </ProgressTrack>
                </Progress>
              ) : null}
              <span className="truncate">{subtitle}</span>
            </span>
          }
          amount={<span className="inline-flex items-center gap-2">{amount}<ChevronRight aria-hidden className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" /></span>}
          onClick={onOpen}
        />
      </Card>
    </section>
  )
}
