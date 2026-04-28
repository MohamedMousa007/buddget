'use client'

import { useCallback, useMemo, useState } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import type { ExpenseCategory } from '@/lib/store/types'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

type PresetRow = {
  id: string
  defaultLabel: string
  category: ExpenseCategory
  enabled: boolean
  amount: string
  /** Editable label; starts as defaultLabel */
  name: string
}

const DEFAULT_PRESETS: Omit<PresetRow, 'name'>[] = [
  { id: 'rent', defaultLabel: 'Rent / Housing', category: 'Rent', enabled: false, amount: '' },
  { id: 'dewa', defaultLabel: 'Electricity (DEWA)', category: 'Other', enabled: false, amount: '' },
  { id: 'internet', defaultLabel: 'Internet', category: 'Other', enabled: false, amount: '' },
  { id: 'mobile', defaultLabel: 'Mobile plan', category: 'Other', enabled: false, amount: '' },
  { id: 'school', defaultLabel: 'School fees', category: 'Other', enabled: false, amount: '' },
  { id: 'car', defaultLabel: 'Car loan', category: 'Debt', enabled: false, amount: '' },
  { id: 'insurance', defaultLabel: 'Insurance', category: 'Other', enabled: false, amount: '' },
]

type CustomRow = { clientId: string; name: string; amount: string }

function buildFixedCostsFromState(presets: PresetRow[], customs: CustomRow[]): {
  name: string
  amount: number
  category: ExpenseCategory
}[] {
  const out: { name: string; amount: number; category: ExpenseCategory }[] = []
  for (const p of presets) {
    if (!p.enabled) continue
    const n = parseFloat(p.amount.replace(/,/g, '.'))
    if (!Number.isFinite(n) || n <= 0) continue
    const label = p.name.trim() || p.defaultLabel
    out.push({ name: label, amount: n, category: p.category })
  }
  for (const c of customs) {
    const n = parseFloat(c.amount.replace(/,/g, '.'))
    if (!c.name.trim() || !Number.isFinite(n) || n <= 0) continue
    out.push({ name: c.name.trim(), amount: n, category: 'Other' })
  }
  return out
}

export function StepFixedCosts({ updateDraft }: Pick<OnboardingStepProps, 'updateDraft'>) {
  const [presets, setPresets] = useState<PresetRow[]>(() =>
    DEFAULT_PRESETS.map((p) => ({ ...p, name: p.defaultLabel })),
  )
  const [customs, setCustoms] = useState<CustomRow[]>([])

  const flushDraft = useCallback(
    (nextPresets: PresetRow[], nextCustoms: CustomRow[]) => {
      updateDraft({ fixedCosts: buildFixedCostsFromState(nextPresets, nextCustoms) })
    },
    [updateDraft],
  )

  const presetBlock = useMemo(
    () =>
      presets.map((p, i) => (
        <div
          key={p.id}
          className={`rounded-xl border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap ${
            p.enabled ? 'border-[#E50914] bg-[#E50914]/10' : 'border-[#2A2A38] bg-[#111118]'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={p.enabled}
              onCheckedChange={(on) => {
                const copy = [...presets]
                const row = copy[i]
                if (!row) return
                copy[i] = { ...row, enabled: on }
                setPresets(copy)
                flushDraft(copy, customs)
              }}
              aria-label={`Toggle ${p.defaultLabel}`}
            />
          </div>
          <Input
            value={p.name}
            onChange={(e) => {
              const copy = [...presets]
              const row = copy[i]
              if (!row) return
              copy[i] = { ...row, name: e.target.value }
              setPresets(copy)
              flushDraft(copy, customs)
            }}
            disabled={!p.enabled}
            className="flex-1 min-w-[140px] bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg"
          />
          <Input
            type="text"
            inputMode="decimal"
            value={p.amount}
            onChange={(e) => {
              const copy = [...presets]
              const row = copy[i]
              if (!row) return
              copy[i] = { ...row, amount: e.target.value }
              setPresets(copy)
              flushDraft(copy, customs)
            }}
            disabled={!p.enabled}
            placeholder="AED"
            aria-label={`Amount for ${p.defaultLabel}`}
            className="w-full sm:w-32 bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg"
          />
        </div>
      )),
    [customs, flushDraft, presets],
  )

  return (
    <div className="w-full max-w-lg mx-auto space-y-3 flex-1 flex flex-col">
      <div className="space-y-2">{presetBlock}</div>
      {customs.map((c, i) => (
        <div key={c.clientId} className="flex flex-wrap gap-2 items-center bg-[#111118] border border-[#2A2A38] rounded-xl p-3">
          <Input
            value={c.name}
            onChange={(e) => {
              const copy = [...customs]
              const row = copy[i]
              if (!row) return
              copy[i] = { ...row, name: e.target.value }
              setCustoms(copy)
              flushDraft(presets, copy)
            }}
            placeholder="Custom cost name"
            className="flex-1 min-w-[120px] bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg"
          />
          <Input
            type="text"
            inputMode="decimal"
            value={c.amount}
            onChange={(e) => {
              const copy = [...customs]
              const row = copy[i]
              if (!row) return
              copy[i] = { ...row, amount: e.target.value }
              setCustoms(copy)
              flushDraft(presets, copy)
            }}
            placeholder="Amount"
            className="w-28 bg-[#0A0A0F] border-[#2A2A38] text-white rounded-lg"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const next = [...customs, { clientId: `c-${Date.now()}`, name: '', amount: '' }]
          setCustoms(next)
          flushDraft(presets, next)
        }}
        className="text-sm text-[#E50914] hover:underline self-start"
      >
        + Add custom
      </button>
    </div>
  )
}
