'use client'

import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import type { FlowNode, FlowValue } from '@/lib/budget/flow/types'
import type { Currency } from '@/lib/store/types'
import { OPTION_ICONS } from './optionIcons'
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
    case 'multi': {
      const multi = q.control === 'multi'
      const picked = asArray(value)
      const opts = q.opts ?? []
      const roomy = opts.length > 6
      const wide = opts.some((o) => (copy.opts?.[o] ?? o).length > 24)
      return (
        <div role={multi ? 'group' : 'radiogroup'} aria-label={copy.label} className={roomy ? 'flex flex-wrap gap-2' : `grid gap-2 ${wide || opts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {opts.map((o) => {
            const on = multi ? picked.includes(o) : value === o
            const full = multi && q.max !== undefined && picked.length >= q.max && !on
            const label = copy.opts?.[o] ?? o
            const Icon = OPTION_ICONS[o]
            const pick = () => onChange(multi ? (on ? picked.filter((x) => x !== o) : [...picked, o]) : o)
            return roomy ? (
              <OptionChip key={o} as="trigger" size="md" selected={on} disabled={full} onClick={pick}>
                {label}
              </OptionChip>
            ) : (
              <SelectableCard key={o} as={multi ? 'checkbox' : 'radio'} layout="row" surface="card" selected={on} disabled={full} onClick={pick} className="min-h-12 gap-2 px-3.5 py-2.5">
                {Icon ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-elevated)] text-[var(--color-brand-primary-ink)]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-[var(--color-brand-text-primary)]">{label}</span>
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'border-[var(--color-brand-border)]'}`}
                >
                  {on ? <Check className="size-3.5" /> : null}
                </span>
              </SelectableCard>
            )
          })}
        </div>
      )
    }
    case 'toggle':
      return (
        <SegmentedControl
          ariaLabel={copy.label}
          value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={(v) => onChange(v === 'yes')}
          options={[
            { value: 'yes', label: ui.yes },
            { value: 'no', label: ui.no },
          ]}
        />
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
