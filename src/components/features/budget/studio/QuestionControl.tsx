'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import type { FlowNode, FlowValue } from '@/lib/budget/flow/types'
import type { Currency } from '@/lib/store/types'
import { reconcileTyped } from '@/lib/ui/typedAmount'
import type { BudgetStudioCopy, StudioQuestionCopy } from '@/lib/i18n/budgetPage/studioCopy'

export interface QuestionControlProps {
  node: FlowNode
  copy: StudioQuestionCopy
  ui: BudgetStudioCopy
  base: Currency
  value: FlowValue | undefined
  onChange: (v: FlowValue | undefined) => void
}

/** Controls whose number is a share, so it reads with a percent sign. */
const PERCENT_IDS = new Set(['partnerSharePct', 'taxPct'])

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const step = (q: FlowNode) => (q.id === 'securityLean' ? 5 : 1)

/** The input for one studio question, picked by the question's control kind. */
export function QuestionControl({ node: q, copy, ui, base, value, onChange }: QuestionControlProps) {
  switch (q.control) {
    case 'chips':
      return (
        <div className="flex flex-wrap gap-2">
          {q.opts?.map((o) => (
            <OptionChip key={o} as="trigger" size="md" selected={value === o} onClick={() => onChange(o)}>
              {copy.opts?.[o] ?? o}
            </OptionChip>
          ))}
        </div>
      )
    case 'multi': {
      const picked = asArray(value)
      return (
        <div className="flex flex-wrap gap-2">
          {q.opts?.map((o) => {
            const on = picked.includes(o)
            const full = q.max !== undefined && picked.length >= q.max && !on
            return (
              <OptionChip
                key={o}
                as="trigger"
                size="md"
                selected={on}
                disabled={full}
                onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])}
              >
                {copy.opts?.[o] ?? o}
              </OptionChip>
            )
          })}
        </div>
      )
    }
    case 'toggle':
      return (
        <div className="flex gap-2">
          <OptionChip as="trigger" size="segment" selected={value === true} onClick={() => onChange(true)}>
            {ui.yes}
          </OptionChip>
          <OptionChip as="trigger" size="segment" selected={value === false} onClick={() => onChange(false)}>
            {ui.no}
          </OptionChip>
        </div>
      )
    case 'stepper': {
      const n = typeof value === 'number' ? value : (q.min ?? 0)
      const set = (next: number) => onChange(Math.min(q.max ?? Infinity, Math.max(q.min ?? 0, next)))
      return (
        <div className="flex items-center justify-center gap-6">
          <IconButton variant="outlined" size="lg" aria-label={ui.stepper.less} onClick={() => set(n - step(q))}>
            <Minus />
          </IconButton>
          <span className="font-mono-numbers min-w-16 text-center text-4xl font-semibold text-[var(--color-brand-text-primary)]">{PERCENT_IDS.has(q.id) ? `${n}%` : n}</span>
          <IconButton variant="outlined" size="lg" aria-label={ui.stepper.more} onClick={() => set(n + step(q))}>
            <Plus />
          </IconButton>
        </div>
      )
    }
    case 'amount':
      return (
        <StudioAmount value={typeof value === 'number' ? value : undefined} onChange={onChange} currency={base} label={copy.label} />
      )
    case 'slider':
      return (
        <div className="flex flex-col gap-2">
          <input
            type="range"
            className="h-11 w-full accent-[var(--color-brand-primary)]"
            min={q.min ?? 0}
            max={q.max ?? 100}
            step={step(q)}
            value={typeof value === 'number' ? value : 50}
            aria-label={copy.label}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {q.id === 'partnerSharePct' ? (
            <p className="font-mono-numbers text-center text-2xl font-semibold text-[var(--color-brand-text-primary)]">{typeof value === 'number' ? value : 50}%</p>
          ) : (
            <div className="flex justify-between text-xs text-[var(--color-brand-text-secondary)]">
              <span>{ui.slider.low}</span>
              <span>{ui.slider.high}</span>
            </div>
          )}
        </div>
      )
    default:
      return null
  }
}

/** Amount answer that keeps what is being typed ("1.", empty) instead of reformatting the stored number under the cursor. */
function StudioAmount({ value, onChange, currency, label }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  currency: Currency
  label: string
}) {
  const [typed, setTyped] = useState(value == null ? '' : String(value))
  return (
    <AmountField
      value={value == null ? '' : reconcileTyped(typed, value)}
      onChange={(v) => {
        setTyped(v)
        onChange(v === '' ? undefined : Number(v) || 0)
      }}
      currency={currency}
      label={label}
    />
  )
}
