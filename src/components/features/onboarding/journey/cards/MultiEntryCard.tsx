'use client'

import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import { PaymentMethodRowEditor } from '@/components/features/onboarding/journey/cards/editors/PaymentMethodRowEditor'
import { IncomeSourceRowEditor } from '@/components/features/onboarding/journey/cards/editors/IncomeSourceRowEditor'
import type {
  JourneyAnswers,
  MultiCard,
  PaymentMethodDraft,
  IncomeSourceDraft,
} from '@/lib/onboarding/journeyTypes'

/**
 * A "one card → many rows" editor. The card renders a compact list of
 * entries already added, with an inline editor for creating / editing
 * a single row at a time. Never more than one editor open at once.
 *
 * Entity-specific field UX lives in `editors/*RowEditor.tsx` — this
 * component is just the list/add/edit/delete chrome.
 *
 * The runner's Next button is gated on the card's `minEntries` via
 * `isCurrentComplete` in `JourneyRunner.tsx`, so we don't have to wire
 * validation here — just write through to `onChange(entries)` on every
 * save/delete.
 */
export interface MultiEntryCardProps {
  card: MultiCard
  entries: ReadonlyArray<unknown>
  onChange: (next: unknown[]) => void
  /** The full answers blob, so row editors can cross-reference (e.g. the
   *  income editor reads the list of payment methods just captured). */
  answers: JourneyAnswers
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; index: number }

export function MultiEntryCard({ card, entries, onChange, answers }: MultiEntryCardProps) {
  const t = useT()
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })

  const list = entries as unknown[]

  const closeEditor = () => setEditor({ mode: 'closed' })

  const handleSave = (row: unknown) => {
    if (editor.mode === 'new') {
      onChange([...list, row])
    } else if (editor.mode === 'edit') {
      const next = list.slice()
      next[editor.index] = row
      onChange(next)
    }
    closeEditor()
  }

  const handleDelete = (index: number) => {
    const next = list.slice()
    next.splice(index, 1)
    onChange(next)
    if (editor.mode === 'edit' && editor.index === index) closeEditor()
  }

  const existingRow =
    editor.mode === 'edit' ? (list[editor.index] as unknown | undefined) : undefined

  return (
    <div className="space-y-3">
      {/* Row list */}
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((row, i) => (
            <li key={i}>
              <RowSummary
                entity={card.entity}
                row={row}
                onEdit={() => setEditor({ mode: 'edit', index: i })}
                onDelete={() => handleDelete(i)}
              />
            </li>
          ))}
        </ul>
      ) : editor.mode === 'closed' ? (
        <EmptyHint entity={card.entity} />
      ) : null}

      {/* Inline editor (single row at a time) */}
      {editor.mode !== 'closed' ? (
        <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
          <RowEditor
            entity={card.entity}
            initial={existingRow}
            answers={answers}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditor({ mode: 'new' })}
          disabled={card.maxEntries != null && list.length >= card.maxEntries}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3',
            'text-sm font-medium transition-colors',
            'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]',
            'hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {readI18n(t, `onboarding.journey.multi.add.${card.entity}`)}
        </button>
      )}
    </div>
  )
}

// ─── Row summary + empty hint ──────────────────────────────────────────

function RowSummary({
  entity,
  row,
  onEdit,
  onDelete,
}: {
  entity: MultiCard['entity']
  row: unknown
  onEdit: () => void
  onDelete: () => void
}) {
  const summary = summarize(entity, row)
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3',
        'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">
          {summary.primary}
        </div>
        {summary.secondary ? (
          <div className="text-xs text-[var(--color-brand-text-muted)] truncate">
            {summary.secondary}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/10"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

function EmptyHint({ entity }: { entity: MultiCard['entity'] }) {
  const t = useT()
  return (
    <p className="text-xs text-[var(--color-brand-text-muted)] text-center py-4">
      {readI18n(t, `onboarding.journey.multi.empty.${entity}`)}
    </p>
  )
}

// ─── Summary per entity ────────────────────────────────────────────────

function summarize(
  entity: MultiCard['entity'],
  row: unknown,
): { primary: string; secondary?: string } {
  if (entity === 'paymentMethods') {
    const pm = row as PaymentMethodDraft
    return {
      primary: pm.name || '—',
      secondary: `${pm.type.replace('_', ' ')} · ${pm.currency}${
        pm.isDefault ? ' · default' : ''
      }`,
    }
  }
  if (entity === 'incomeSources') {
    const inc = row as IncomeSourceDraft
    const freq = inc.isRecurring
      ? inc.recurringFrequency ?? 'monthly'
      : 'one-time'
    return {
      primary: inc.name || '—',
      secondary: `${inc.amount.toLocaleString()} ${inc.currency} · ${freq}`,
    }
  }
  return { primary: '—' }
}

// ─── Row editor dispatch ───────────────────────────────────────────────

function RowEditor({
  entity,
  initial,
  answers,
  onSave,
  onCancel,
}: {
  entity: MultiCard['entity']
  initial: unknown
  answers: JourneyAnswers
  onSave: (row: unknown) => void
  onCancel: () => void
}) {
  if (entity === 'paymentMethods') {
    return (
      <PaymentMethodRowEditor
        initial={initial as PaymentMethodDraft | undefined}
        defaultCurrency={answers.identity.baseCurrency ?? 'USD'}
        onSave={(row) => onSave(row)}
        onCancel={onCancel}
      />
    )
  }
  if (entity === 'incomeSources') {
    return (
      <IncomeSourceRowEditor
        initial={initial as IncomeSourceDraft | undefined}
        defaultCurrency={answers.identity.baseCurrency ?? 'USD'}
        paymentMethods={answers.moneyIn.paymentMethods}
        onSave={(row) => onSave(row)}
        onCancel={onCancel}
      />
    )
  }
  // Other entities (debts, subscriptions, savings, goals) land in PR2.
  return null
}
