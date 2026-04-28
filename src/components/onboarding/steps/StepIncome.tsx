'use client'

import { useEffect } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import type { Currency } from '@/lib/store/types'
import { Input } from '@/components/ui/input'

const CURRENCY_OPTIONS: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR']

export function StepIncome({ draft, updateDraft }: OnboardingStepProps) {
  useEffect(() => {
    if (draft.incomeSources.length === 0) {
      updateDraft({
        incomeSources: [
          { name: '', amount: 0, currency: draft.baseCurrency, isRecurring: true },
        ],
      })
    }
  }, [draft.baseCurrency, draft.incomeSources.length, updateDraft])

  const rows =
    draft.incomeSources.length > 0 ?
      draft.incomeSources
    : [{ name: '', amount: 0, currency: draft.baseCurrency, isRecurring: true }]

  function setRows(next: typeof rows) {
    updateDraft({ incomeSources: next })
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-3 flex-1 flex flex-col">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-2 bg-[#111118] border border-[#2A2A38] rounded-xl p-3"
        >
          <Input
            value={row.name}
            onChange={(e) => {
              const copy = [...rows]
              const r = copy[i]
              if (!r) return
              copy[i] = { ...r, name: e.target.value }
              setRows(copy)
            }}
            placeholder="e.g. Salary, Freelance"
            className="flex-1 min-w-[120px] bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg h-10"
            aria-label={`Income source ${i + 1} name`}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={row.amount || ''}
            onChange={(e) => {
              const copy = [...rows]
              const r = copy[i]
              if (!r) return
              copy[i] = { ...r, amount: parseFloat(e.target.value) || 0 }
              setRows(copy)
            }}
            className="w-28 bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg h-10"
            aria-label={`Income source ${i + 1} amount`}
          />
          <select
            value={row.currency}
            onChange={(e) => {
              const copy = [...rows]
              const r = copy[i]
              if (!r) return
              copy[i] = { ...r, currency: e.target.value as Currency }
              setRows(copy)
            }}
            className="h-10 rounded-lg bg-[#0A0A0F] border border-[#2A2A38] text-white text-sm px-2"
            aria-label={`Income source ${i + 1} currency`}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={rows.length <= 1}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="text-[#A0A0B8] hover:text-[#E50914] disabled:opacity-30 px-2 text-lg leading-none"
            aria-label={`Remove income source ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows([...rows, { name: '', amount: 0, currency: draft.baseCurrency, isRecurring: true }])
        }
        className="text-sm text-[#E50914] hover:underline self-start"
      >
        + Add another source
      </button>
    </div>
  )
}
