'use client'

import { useState } from 'react'
import { ArrowRight, Check, Pencil } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import type { HouseholdType } from '@/lib/budget/lifestyleMappings'

const HOUSEHOLD_OPTIONS: { value: HouseholdType; label: string }[] = [
  { value: 'solo', label: 'Just me' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
]

/**
 * Step 1: Confirm AI-extracted basics. Tappable rows with inline editing.
 */
export function BuddgyStepConfirm({ flow }: { flow: BuddgyBuilderApi }) {
  const { basics, setBasics } = flow
  const [editingField, setEditingField] = useState<string | null>(null)

  const rows = [
    { key: 'income', label: 'Monthly income', value: `${basics.currency} ${basics.income.toLocaleString()}`, editable: true },
    { key: 'city', label: 'City', value: basics.city || '—', editable: true },
    { key: 'household', label: 'Household', value: basics.household === 'solo' ? 'Just me' : basics.household === 'couple' ? 'Couple' : 'Family', editable: true },
    { key: 'rent', label: 'Rent', value: basics.rent > 0 ? `${basics.currency} ${basics.rent.toLocaleString()}` : '—', editable: true },
    { key: 'utilities', label: 'Utilities', value: basics.rentIncludesUtilities ? 'Included in rent' : 'Separate', editable: true },
  ]

  const canConfirm = basics.income > 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-brand-text-primary)]">
        Here&apos;s what I got. Tap to fix anything.
      </p>

      <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] divide-y divide-[var(--color-brand-border)] overflow-hidden">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-[var(--color-brand-text-secondary)]">{row.label}</span>

            {editingField === row.key ? (
              <EditField
                field={row.key}
                basics={basics}
                setBasics={setBasics}
                onDone={() => setEditingField(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => row.editable && setEditingField(row.key)}
                className="flex items-center gap-2 text-sm font-mono text-[var(--color-brand-text-primary)] hover:text-[var(--color-brand-red)] transition-colors"
              >
                {row.value}
                {row.editable ? (
                  <Pencil className="h-3 w-3 text-[var(--color-brand-text-muted)]" />
                ) : (
                  <Check className="h-3 w-3 text-[var(--color-brand-green)]" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {!canConfirm && (
        <p className="text-xs text-[var(--color-brand-amber)]">
          Tap income to add your monthly earnings.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={flow.confirmBasics}
          disabled={!canConfirm}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Looks right
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function EditField({
  field,
  basics,
  setBasics,
  onDone,
}: {
  field: string
  basics: BuddgyBuilderApi['basics']
  setBasics: BuddgyBuilderApi['setBasics']
  onDone: () => void
}) {
  if (field === 'household') {
    return (
      <div className="flex gap-1.5">
        {HOUSEHOLD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setBasics((prev) => ({ ...prev, household: opt.value }))
              onDone()
            }}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              basics.household === opt.value
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  if (field === 'utilities') {
    return (
      <div className="flex gap-1.5">
        {[
          { value: true, label: 'Included' },
          { value: false, label: 'Separate' },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => {
              setBasics((prev) => ({ ...prev, rentIncludesUtilities: opt.value }))
              onDone()
            }}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              basics.rentIncludesUtilities === opt.value
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  const isNumber = field === 'income' || field === 'rent'
  const currentValue =
    field === 'income' ? String(basics.income || '')
    : field === 'rent' ? String(basics.rent || '')
    : field === 'city' ? basics.city
    : ''

  return (
    <input
      type={isNumber ? 'number' : 'text'}
      defaultValue={currentValue}
      autoFocus
      onBlur={(e) => {
        const val = e.target.value
        if (field === 'income') setBasics((prev) => ({ ...prev, income: Number(val) || 0 }))
        else if (field === 'rent') setBasics((prev) => ({ ...prev, rent: Number(val) || 0 }))
        else if (field === 'city') setBasics((prev) => ({ ...prev, city: val }))
        onDone()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') onDone()
      }}
      className="w-28 rounded-lg border border-[var(--color-brand-red)]/40 bg-[var(--color-brand-card)] px-2 py-1 text-right text-sm font-mono text-[var(--color-brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40"
    />
  )
}
