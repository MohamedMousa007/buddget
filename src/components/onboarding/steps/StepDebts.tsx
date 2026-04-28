'use client'

import { useEffect, useState } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import type { Currency, GoldKarat } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

const KARATS: GoldKarat[] = [24, 22, 21, 18]
const DEBT_CURRENCIES = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR'] as Currency[]

function emptyRow(base: Currency) {
  return {
    name: '',
    person: '',
    startingBalance: 0,
    currency: base,
    isGold: false,
    goldKarat: 24 as GoldKarat,
  }
}

export function StepDebts({ draft, updateDraft }: OnboardingStepProps) {
  const [choice, setChoice] = useState<'unset' | 'yes' | 'no'>(() =>
    draft.debts.length > 0 ? 'yes' : 'unset',
  )

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- draft can hydrate after mount (resume) */
    if (draft.debts.length > 0) setChoice('yes')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draft.debts.length])

  function setDebts(
    rows: Array<{
      name: string
      person: string
      startingBalance: number
      currency: string
      isGold: boolean
      goldKarat?: GoldKarat
    }>,
  ) {
    updateDraft({ debts: rows })
  }

  const rows = draft.debts.length > 0 ? draft.debts : []

  if (choice === 'unset') {
    return (
      <div className="w-full max-w-lg mx-auto space-y-3 flex-1 flex flex-col">
        <button
          type="button"
          onClick={() => {
            setChoice('yes')
            if (draft.debts.length === 0) setDebts([emptyRow(draft.baseCurrency)])
          }}
          className="w-full p-5 rounded-2xl border border-[#2A2A38] bg-[#111118] text-left hover:border-[#E50914] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E50914]"
        >
          <span className="text-xl mr-2" aria-hidden>
            ✓
          </span>
          <span className="text-white font-medium">Yes, I have debts to track</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setChoice('no')
            setDebts([])
          }}
          className="w-full p-5 rounded-2xl border border-[#2A2A38] bg-[#111118] text-left hover:border-[#E50914] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E50914]"
        >
          <span className="text-xl mr-2" aria-hidden>
            →
          </span>
          <span className="text-white font-medium">No, skip this for now</span>
        </button>
      </div>
    )
  }

  if (choice === 'no') {
    return (
      <p className="text-sm text-[#A0A0B8] max-w-lg mx-auto">
        You can add debts later from the app.{' '}
        <button
          type="button"
          className="text-[#E50914] underline"
          onClick={() => {
            setChoice('yes')
            setDebts([emptyRow(draft.baseCurrency)])
          }}
        >
          Track debts instead
        </button>
      </p>
    )
  }

  const displayRows = rows.length > 0 ? rows : [emptyRow(draft.baseCurrency)]

  return (
    <div className="w-full max-w-lg mx-auto space-y-3 flex-1 flex flex-col">
      {displayRows.map((row, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 p-3 rounded-xl bg-[#111118] border border-[#2A2A38]"
        >
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={row.person}
              onChange={(e) => {
                const copy = [...displayRows]
                const r = copy[i]
                if (!r) return
                copy[i] = { ...r, person: e.target.value }
                setDebts(copy)
              }}
              placeholder="Person / creditor"
              className="flex-1 min-w-[100px] bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg h-10"
            />
            <Input
              value={row.name}
              onChange={(e) => {
                const copy = [...displayRows]
                const r = copy[i]
                if (!r) return
                copy[i] = { ...r, name: e.target.value }
                setDebts(copy)
              }}
              placeholder="Debt label"
              className="flex-1 min-w-[100px] bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg h-10"
            />
            <Input
              type="number"
              min={0}
              step="any"
              value={row.startingBalance || ''}
              onChange={(e) => {
                const copy = [...displayRows]
                const r = copy[i]
                if (!r) return
                copy[i] = { ...r, startingBalance: parseFloat(e.target.value) || 0 }
                setDebts(copy)
              }}
              className="w-28 bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg h-10"
              aria-label={row.isGold ? 'Grams' : 'Amount'}
            />
            {!row.isGold ? (
              <select
                value={DEBT_CURRENCIES.includes(row.currency as Currency) ? row.currency : draft.baseCurrency}
                onChange={(e) => {
                  const copy = [...displayRows]
                  const r = copy[i]
                  if (!r) return
                  copy[i] = { ...r, currency: e.target.value }
                  setDebts(copy)
                }}
                className="h-10 rounded-lg bg-[#0A0A0F] border border-[#2A2A38] text-white text-sm px-2"
              >
                {DEBT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={row.goldKarat ?? 24}
                onChange={(e) => {
                  const copy = [...displayRows]
                  const r = copy[i]
                  if (!r) return
                  copy[i] = { ...r, goldKarat: Number(e.target.value) as GoldKarat }
                  setDebts(copy)
                }}
                className="h-10 rounded-lg bg-[#0A0A0F] border border-[#2A2A38] text-white text-sm px-2"
                aria-label="Gold karat"
              >
                {KARATS.map((k) => (
                  <option key={k} value={k}>
                    {k}k
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={row.isGold}
                onCheckedChange={(on) => {
                  const copy = [...displayRows]
                  const r = copy[i]
                  if (!r) return
                  copy[i] = {
                    ...r,
                    isGold: on,
                    currency: on ? 'XAU' : draft.baseCurrency,
                    goldKarat: on ? (r.goldKarat ?? 24) : undefined,
                  }
                  setDebts(copy)
                }}
                aria-label="Gold debt"
              />
              <span className="text-xs text-[#A0A0B8]">Gold</span>
            </div>
            <button
              type="button"
              disabled={displayRows.length <= 1}
              onClick={() => setDebts(displayRows.filter((_, j) => j !== i))}
              className="text-[#A0A0B8] hover:text-[#E50914] disabled:opacity-30 px-1"
              aria-label="Remove debt row"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[#5A5A72]">{row.isGold ? 'Amount in grams' : `Amount (${row.currency})`}</p>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setDebts([...displayRows, emptyRow(draft.baseCurrency)])}
        className="text-sm text-[#E50914] hover:underline self-start"
      >
        + Add another
      </button>
    </div>
  )
}
