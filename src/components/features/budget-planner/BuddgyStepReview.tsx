'use client'

import { useState } from 'react'
import { ArrowRight, Pencil } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { HouseholdType } from '@/lib/budget/lifestyleMappings'

const HOUSEHOLD_OPTIONS: { value: HouseholdType; label: string }[] = [
  { value: 'solo', label: 'Just me' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
]

/**
 * Review + confirm step — replaces BuddgyStepConfirm in the refactored flow.
 *
 * Shows what Buddget already knows (income, currency, country, city) pulled
 * from the store with inline Edit links that open the corresponding settings
 * sheet. Buddgy-specific basics (household, rent) still live here since
 * they're not stored globally. A "Build my plan" CTA advances to lifestyle
 * — same forward edge as the old confirm step.
 */
export function BuddgyStepReview({ flow }: { flow: BuddgyBuilderApi }) {
  const { basics, setBasics } = flow
  const [editing, setEditing] = useState<'rent' | null>(null)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)

  const { profileCity, profileCountry } = useFinanceStore(
    useShallow((s) => ({
      profileCity: s.profile.city || '',
      profileCountry: s.profile.country || '',
    })),
  )

  const incomeLine =
    basics.income > 0
      ? `${basics.currency} ${basics.income.toLocaleString()}`
      : '—'
  const locationLine =
    [basics.city || profileCity, basics.country || profileCountry].filter(Boolean).join(', ') ||
    '—'

  const canContinue = basics.income > 0

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[var(--color-brand-text-primary)]">Here&apos;s what we know.</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          Tap any row to edit — we won&apos;t ask again.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] divide-y divide-[var(--color-brand-border)] overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveModal('addIncome')}
          className="w-full flex items-center justify-between px-4 py-3 text-start hover:bg-[var(--color-brand-card)] transition-colors"
        >
          <span className="text-xs text-[var(--color-brand-text-secondary)]">Monthly income</span>
          <span className="flex items-center gap-2 text-sm font-mono text-[var(--color-brand-text-primary)]">
            {incomeLine}
            <Pencil className="h-3 w-3 text-[var(--color-brand-text-muted)]" />
          </span>
        </button>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">Location</span>
          <span className="text-sm text-[var(--color-brand-text-primary)]">{locationLine}</span>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">Household</span>
          <div className="flex gap-1.5">
            {HOUSEHOLD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBasics((prev) => ({ ...prev, household: opt.value }))}
                className={
                  'rounded-lg px-3 py-1 text-xs font-medium transition-colors ' +
                  (basics.household === opt.value
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">Rent</span>
          {editing === 'rent' ? (
            <input
              type="number"
              defaultValue={basics.rent || ''}
              autoFocus
              onBlur={(e) => {
                setBasics((prev) => ({ ...prev, rent: Number(e.target.value) || 0 }))
                setEditing(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditing(null)
              }}
              className="w-28 rounded-lg border border-[var(--color-brand-red)]/40 bg-[var(--color-brand-card)] px-2 py-1 text-right text-sm font-mono text-[var(--color-brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing('rent')}
              className="flex items-center gap-2 text-sm font-mono text-[var(--color-brand-text-primary)] hover:text-[var(--color-brand-red)] transition-colors"
            >
              {basics.rent > 0 ? `${basics.currency} ${basics.rent.toLocaleString()}` : '—'}
              <Pencil className="h-3 w-3 text-[var(--color-brand-text-muted)]" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-[var(--color-brand-text-secondary)]">Utilities</span>
          <div className="flex gap-1.5">
            {[
              { value: true, label: 'Included' },
              { value: false, label: 'Separate' },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setBasics((prev) => ({ ...prev, rentIncludesUtilities: opt.value }))}
                className={
                  'rounded-lg px-3 py-1 text-xs font-medium transition-colors ' +
                  (basics.rentIncludesUtilities === opt.value
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!canContinue ? (
        <p className="text-xs text-[var(--color-brand-amber)]">
          Tap the income row to add your monthly earnings first.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={flow.confirmBasics}
          disabled={!canContinue}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Looks right
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
