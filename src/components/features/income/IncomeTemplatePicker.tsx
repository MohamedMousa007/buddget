'use client'

import type { IncomeSource } from '@/lib/store/types'
import { MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'
import { Button } from '@/components/ui/button'

export interface IncomeTemplatePickerProps {
  /** Selected template id, or '' for "not linked". */
  value: string
  onChange: (id: string) => void
  /** Active recurring income templates to choose from. */
  templates: IncomeSource[]
  label: string
  noneLabel: string
  /** When set and nothing is linked, offer a one-tap link to the likely template. */
  suggestion?: { id: string; name: string } | null
  suggestionLabel?: (name: string) => string
}

/**
 * Optional link from a received income event to the recurring template it fulfills.
 * A styled native select (secondary field — no need for a custom sheet) plus an
 * optional smart-suggest chip when the amount looks like an existing template.
 */
export function IncomeTemplatePicker({
  value,
  onChange,
  templates,
  label,
  noneLabel,
  suggestion,
  suggestionLabel,
}: IncomeTemplatePickerProps) {
  if (templates.length === 0) return null
  return (
    <div>
      <label htmlFor="income-template-select" className={MODAL_LABEL_CLASS}>{label}</label>
      <select
        id="income-template-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-focus)] focus:outline-none"
      >
        <option value="">{noneLabel}</option>
        {templates.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.amount.toLocaleString('en-US')} {s.currency}
          </option>
        ))}
      </select>
      {suggestion && !value ? (
        <Button
          onClick={() => onChange(suggestion.id)}
          variant="link"
          size="xs"
          className="mt-1.5 no-underline hover:underline"
        >
          {(suggestionLabel ?? ((n) => n))(suggestion.name)}
        </Button>
      ) : null}
    </div>
  )
}
