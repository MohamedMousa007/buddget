'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useTutorial } from '@/hooks/useTutorial'
import { AddSavingsAccountSheet } from '@/components/modals/AddSavingsAccountSheet'
import { AddSubscriptionSheet } from '@/components/modals/AddSubscriptionSheet'
import { AddGoalSheet } from '@/components/modals/AddGoalSheet'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { ModalCard } from '@/lib/onboarding/journeyTypes'

/**
 * Renders a `modal` journey card. Opens the real app modal for the given
 * entity, waits for the user to save rows into the actual store slice,
 * then shows an "Add another / Continue" footer.
 *
 * Three entities use store-dispatched modals (`addIncome`,
 * `addPaymentMethod`, `addDebt`) opened via `setActiveModal(id)` —
 * `ModalProvider` renders them at the app root. Three use prop-controlled
 * sheets (`AddSavingsAccountSheet`, `AddSubscriptionSheet`,
 * `AddGoalSheet`) which we render inline here.
 *
 * "Save detection" = watching the relevant store slice's length. Every
 * save bumps the count and the modal auto-closes (existing modal
 * behaviour), which triggers the "Saved ✓ / Add another?" state.
 *
 * First-open-per-entity fires the corresponding tutorial tour
 * (`addPmTour`, `addIncomeTour`, …) via the `useTutorial` hook.
 */

export interface OnboardingModalGateProps {
  card: ModalCard
  /** Called by the runner to validate the card is complete; the
   *  runner's Next button is gated on this via its own check of the
   *  store count vs. `minEntries`. */
  onContinueRequested: () => void
}

export function OnboardingModalGate({ card, onContinueRequested }: OnboardingModalGateProps) {
  const t = useT()
  const tutorial = useTutorial()
  const { setActiveModal } = useSettingsStore(
    useShallow((s) => ({ setActiveModal: s.setActiveModal })),
  )

  // Read only the count + last row for the relevant slice. Zustand
  // shallow keeps re-renders tight.
  const { count, lastRowName } = useFinanceStore(
    useShallow((s) => pickCountAndLastRowName(s, card.entity)),
  )

  // Prop-driven sheets: we own their open state locally. Store-driven
  // modals open via `setActiveModal`.
  const [propModalOpen, setPropModalOpen] = useState(false)

  // Auto-open the modal the first time the card mounts, and fire the
  // matching tour if not yet completed. Re-mounts (after user clicks
  // Back then forward) don't re-auto-open — the user explicitly taps
  // Add another.
  //
  // The tutorial start is deferred until the modal's open spring
  // settles: ModalShell dispatches a `buddget:modal-opened` event on
  // `onAnimationComplete`. A 700 ms fallback fires the tour if the
  // event never arrives (user dismisses mid-animation, etc.).
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current) return
    autoOpened.current = true

    openTargetModal()

    const tourId = card.tutorialTourId
    if (!tourId || tutorial.isCompleted(tourId)) return

    let fired = false
    const fire = () => {
      if (fired) return
      fired = true
      tutorial.start(tourId)
      window.removeEventListener('buddget:modal-opened', fire)
    }
    window.addEventListener('buddget:modal-opened', fire, { once: true })
    const fallback = window.setTimeout(fire, 700)

    return () => {
      window.removeEventListener('buddget:modal-opened', fire)
      window.clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-mount only
  }, [])

  const openTargetModal = () => {
    switch (card.entity) {
      case 'paymentMethods':
        setActiveModal('addPaymentMethod')
        break
      case 'incomeSources':
        setActiveModal('addIncome')
        break
      case 'debts':
        setActiveModal('addDebt')
        break
      default:
        // Prop-driven sheets
        setPropModalOpen(true)
        break
    }
  }

  const hasMinimum = count >= card.minEntries
  const reachedMax = card.maxEntries != null && count >= card.maxEntries

  return (
    <div className="space-y-4">
      {/* Summary of what's been saved so far. */}
      <div
        className={cn(
          'rounded-2xl border px-4 py-3',
          count === 0
            ? 'border-dashed border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)]'
            : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]',
        )}
      >
        {count === 0 ? (
          <p className="text-sm">
            {t.onboarding.journey.modalGate.emptyHint}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--color-brand-text-primary)]">
            <Check className="h-4 w-4 text-[var(--color-brand-red)]" aria-hidden />
            <span>
              {t.onboarding.journey.modalGate.savedSummary(count, lastRowName ?? '')}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={openTargetModal}
          disabled={reachedMax}
          className={cn(
            'flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm font-medium',
            'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]',
            'hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {count === 0
            ? t.onboarding.journey.modalGate.addFirst
            : t.onboarding.journey.modalGate.addAnother}
        </button>
        <button
          type="button"
          onClick={onContinueRequested}
          disabled={!hasMinimum}
          className={cn(
            'rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors',
            'bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)]',
            'disabled:bg-[var(--color-brand-elevated)] disabled:text-[var(--color-brand-text-muted)]',
            'disabled:cursor-not-allowed',
          )}
        >
          {t.onboarding.journey.modalGate.continue}
        </button>
      </div>

      {/* Prop-driven sheets rendered inline — the 3 store-driven modals
          are already mounted at the app root via ModalProvider. */}
      {card.entity === 'savingsAccounts' ? (
        <AddSavingsAccountSheet open={propModalOpen} onClose={() => setPropModalOpen(false)} />
      ) : null}
      {card.entity === 'subscriptions' ? (
        <AddSubscriptionSheet
          open={propModalOpen}
          onClose={() => setPropModalOpen(false)}
          editing={null}
          // `instanceKey` forces the inner form to remount each time we
          // reopen via "Add another" — resets the draft state.
          instanceKey={count}
        />
      ) : null}
      {card.entity === 'goals' ? (
        <AddGoalSheet
          open={propModalOpen}
          onClose={() => setPropModalOpen(false)}
          editingGoal={null}
        />
      ) : null}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

type StoreState = ReturnType<typeof useFinanceStore.getState>

function pickCountAndLastRowName(
  s: StoreState,
  entity: ModalCard['entity'],
): { count: number; lastRowName: string | null } {
  switch (entity) {
    case 'paymentMethods': {
      const list = s.paymentMethods
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
    case 'incomeSources': {
      const list = s.incomeSources
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
    case 'debts': {
      const list = s.debts
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
    case 'subscriptions': {
      const list = s.subscriptions
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
    case 'savingsAccounts': {
      const list = s.savingsAccounts
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
    case 'goals': {
      const list = s.goals
      return { count: list.length, lastRowName: list[list.length - 1]?.name ?? null }
    }
  }
}
