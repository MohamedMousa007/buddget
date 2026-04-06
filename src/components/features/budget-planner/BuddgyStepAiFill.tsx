'use client'

import { useCallback, useState } from 'react'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

export function BuddgyStepAiFill({ flow }: { flow: BuddgyFlowApi }) {
  const { aiRows, setAiRows, aiLoading, aiAdjustAll, setAiAdjustAll, settings } = flow
  const [editing, setEditing] = useState<number | null>(null)

  const updateRow = useCallback(
    (index: number, amount: number) => {
      setAiRows((rows) =>
        rows.map((r, i) => (i === index ? { ...r, amount: Math.max(0, amount) } : r))
      )
    },
    [setAiRows]
  )

  const onLooksGood = () => {
    flow.applyAiRows()
    flow.setStep('summary')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">I&apos;ll fill in the rest based on Dubai averages.</p>
      {aiLoading && aiRows.length === 0 ?
        <p className="text-sm text-[var(--color-brand-text-muted)]">One moment.</p>
      : null}
      <ul className="space-y-2">
        {aiRows.map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-[#2A2A38] bg-[#1A1A24] px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {r.name} {r.emoji}
            </span>
            {aiAdjustAll || editing === i ?
              <input
                type="text"
                inputMode="numeric"
                value={String(r.amount)}
                onChange={(e) => updateRow(i, Number.parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                className="w-28 rounded border border-[#2A2A38] bg-[#0A0A0F] px-2 py-1 text-right font-mono text-sm text-white"
              />
            : <button
                type="button"
                onClick={() => setEditing(i)}
                className="shrink-0 font-mono text-sm text-white"
              >
                {new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(r.amount)}{' '}
                {settings.baseCurrency}
              </button>
            }
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onLooksGood}
          disabled={aiRows.length === 0 && aiLoading}
          className="cursor-pointer rounded-xl border border-[#2A2A38] bg-[#1A1A24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1A1A24]/90 disabled:opacity-50"
        >
          Looks good ✓
        </button>
        <button
          type="button"
          onClick={() => setAiAdjustAll(true)}
          className="cursor-pointer rounded-xl bg-[var(--color-brand-red)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Adjust
        </button>
      </div>
    </div>
  )
}
