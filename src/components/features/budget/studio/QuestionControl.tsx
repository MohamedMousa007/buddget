'use client'

import { Minus, Plus } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import type { Question } from '@/lib/budget/infoGaps'
import type { Currency } from '@/lib/store/types'
import type { BudgetStudioCopy, StudioQuestionCopy } from '@/lib/i18n/budgetPage/studioCopy'

export interface QuestionControlProps {
  question: Question
  copy: StudioQuestionCopy
  ui: BudgetStudioCopy
  base: Currency
  value: unknown
  onChange: (v: unknown) => void
}

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])

/** The input for one studio question, picked by the question's control kind. */
export function QuestionControl({ question: q, copy, ui, base, value, onChange }: QuestionControlProps) {
  switch (q.control) {
    case 'confirm':
      return (
        <Button size="cta" className="w-full" onClick={() => onChange(true)}>
          {ui.confirm}
        </Button>
      )
    case 'chips':
    case 'single':
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((o) => (
            <OptionChip key={o.value} as="trigger" size="md" selected={value === o.value} onClick={() => onChange(o.value)}>
              {copy.opts?.[o.value] ?? o.value}
            </OptionChip>
          ))}
        </div>
      )
    case 'multi': {
      const picked = asArray(value)
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((o) => {
            const on = picked.includes(o.value)
            const full = q.max !== undefined && picked.length >= q.max && !on
            return (
              <OptionChip
                key={o.value}
                as="trigger"
                size="md"
                selected={on}
                disabled={full}
                onClick={() => onChange(on ? picked.filter((x) => x !== o.value) : [...picked, o.value])}
              >
                {copy.opts?.[o.value] ?? o.value}
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
      const step = q.step ?? 1
      const set = (next: number) => onChange(Math.min(q.max ?? Infinity, Math.max(q.min ?? 0, next)))
      return (
        <div className="flex items-center justify-center gap-6">
          <IconButton variant="outlined" size="lg" aria-label={ui.stepper.less} onClick={() => set(n - step)}>
            <Minus />
          </IconButton>
          <span className="font-mono-numbers min-w-16 text-center text-4xl font-semibold text-[var(--color-brand-text-primary)]">{n}</span>
          <IconButton variant="outlined" size="lg" aria-label={ui.stepper.more} onClick={() => set(n + step)}>
            <Plus />
          </IconButton>
        </div>
      )
    }
    case 'amount':
      return (
        <AmountField
          value={value == null ? '' : String(value)}
          onChange={(v) => onChange(v === '' ? undefined : Number(v))}
          currency={base}
          label={copy.label}
        />
      )
    case 'slider':
      return (
        <div className="flex flex-col gap-2">
          <input
            type="range"
            className="h-11 w-full accent-[var(--color-brand-primary)]"
            min={q.min ?? 0}
            max={q.max ?? 100}
            step={q.step ?? 1}
            value={typeof value === 'number' ? value : 50}
            aria-label={copy.label}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-[var(--color-brand-text-secondary)]">
            <span>{ui.slider.low}</span>
            <span>{ui.slider.high}</span>
          </div>
        </div>
      )
    default:
      return null
  }
}
