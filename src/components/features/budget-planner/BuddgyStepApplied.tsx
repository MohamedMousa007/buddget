'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'

/**
 * Step 5: Success — branded summary of what was applied.
 * Auto-dismisses after 5 seconds.
 */
export function BuddgyStepApplied({ flow }: { flow: BuddgyBuilderApi }) {
  const { plan, basics, onClose } = flow
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!visible) return null

  const categoryCount = plan?.categories.length ?? 0
  const savingsRate = plan?.summary.savingsRate ?? 0
  const rateLabel = savingsRate >= 40 ? 'amazing' : savingsRate >= 20 ? 'solid' : 'a start'

  return (
    <div className="space-y-4" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClose()}>
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-green)]"
          >
            <Check className="h-5 w-5 text-white" />
          </motion.div>
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            Plan applied
          </p>
        </div>

        <div className="space-y-2">
          <SummaryRow label="Income" value={`${basics.currency} ${basics.income.toLocaleString()}/mo`} badge="updated" />
          <SummaryRow label="Budget" value={`${categoryCount} categories`} badge="created" />
          {basics.city && <SummaryRow label="Location" value={`${basics.city}${basics.country ? `, ${basics.country}` : ''}`} badge="updated" />}
          <SummaryRow label="Savings rate" value={`${savingsRate}%`} badge={rateLabel} />
        </div>

        <p className="text-xs text-[var(--color-brand-text-muted)]">
          You can edit categories below anytime.
        </p>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, badge }: { label: string; value: string; badge: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--color-brand-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-[var(--color-brand-text-primary)]">{value}</span>
        <span className="rounded-md bg-[var(--color-brand-green)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand-green)]">
          {badge}
        </span>
      </div>
    </div>
  )
}
