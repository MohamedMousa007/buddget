'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useJourneyRunner } from '@/hooks/useJourneyRunner'
import { JOURNEY_CARDS } from '@/lib/onboarding/journeyConfig'
import { JOURNEY_PHASES } from '@/lib/onboarding/journeyTypes'
import { InfoCard } from '@/components/features/onboarding/journey/cards/InfoCard'
import { FieldCard } from '@/components/features/onboarding/journey/cards/FieldCard'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'

/**
 * Top-level onboarding Journey orchestrator. Composes:
 *   - a slim header with a back button + phase-progress bar
 *   - the currently-active card (animated via Framer Motion on id change)
 *   - a sticky footer with the Next / Finish button
 *
 * All state lives in `useJourneyRunner`; this component is presentational.
 * Intentionally not wired into `/onboarding` yet — PR1/c5 swaps the entry
 * point behind a feature flag.
 */
export function JourneyRunner() {
  const t = useT()
  const runner = useJourneyRunner({ cards: JOURNEY_CARDS })

  const { currentCard, visibleIndex, progress, answers, canGoBack, advance, back, setAnswer } =
    runner

  // When the currency card opens, seed it from the user's country if they
  // haven't explicitly picked one yet. Shows the currency as a
  // pre-filled, confirmable choice rather than an empty field.
  useEffect(() => {
    if (currentCard?.id !== 'identity.currency') return
    if (answers.identity.baseCurrency) return
    if (!answers.identity.country) return
    const derived = defaultCurrencyForCountry(answers.identity.country, answers.identity.city)
    if (derived) setAnswer('identity.baseCurrency', derived)
    // Only re-run when the card or the inputs change — never loops because
    // the guard above short-circuits once a currency is set.
  }, [
    currentCard?.id,
    answers.identity.country,
    answers.identity.city,
    answers.identity.baseCurrency,
    setAnswer,
  ])

  // The Field cards read + write through `setAnswer(path, value)`; for
  // other cards we derive a no-op.
  const currentValue = useMemo(() => {
    if (!currentCard || currentCard.kind !== 'field') return undefined
    return readByPath(answers, currentCard.writeKey)
  }, [currentCard, answers])

  const handleFieldChange = useCallback(
    (next: unknown) => {
      if (!currentCard || currentCard.kind !== 'field') return
      setAnswer(currentCard.writeKey, next)
    },
    [currentCard, setAnswer],
  )

  const isCurrentComplete = useMemo(() => {
    if (!currentCard) return false
    switch (currentCard.kind) {
      case 'info':
        return true
      case 'field':
        return currentCard.optional === true || isFieldValuePresent(currentValue)
      // Other kinds (multi, ai, review, terminal) ship in later commits.
      default:
        return true
    }
  }, [currentCard, currentValue])

  if (!currentCard) {
    // End of journey — PR2 will replace this with the terminal apply
    // playbook. For now, we simply render nothing so the runner is safe
    // to mount even while the full sequence isn't wired.
    return null
  }

  return (
    <div className="min-h-[100svh] bg-[var(--color-brand-bg)] flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
        <button
          type="button"
          onClick={back}
          disabled={!canGoBack}
          aria-label={t.onboarding.journey.common.back}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center transition-opacity',
            'text-[var(--color-brand-text-secondary)]',
            canGoBack ? 'hover:bg-[var(--color-brand-elevated)]' : 'opacity-0 pointer-events-none',
          )}
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
        </button>

        <div className="flex-1">
          <PhaseProgressBar progress={progress} phaseIndex={JOURNEY_PHASES.indexOf(currentCard.phase)} />
        </div>
      </header>

      {/* Active card */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {renderCardBody({
                card: currentCard,
                value: currentValue,
                onFieldChange: handleFieldChange,
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={cn(
          'sticky bottom-0 border-t border-[var(--color-brand-border)]',
          'bg-[var(--color-brand-bg)]/90 backdrop-blur',
          'px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
        )}
      >
        <div className="mx-auto w-full max-w-xl flex items-center justify-end">
          <button
            type="button"
            onClick={advance}
            disabled={!isCurrentComplete}
            className={cn(
              'h-11 px-6 rounded-full text-sm font-semibold transition-colors',
              'bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white',
              'disabled:bg-[var(--color-brand-elevated)] disabled:text-[var(--color-brand-text-muted)]',
              'disabled:cursor-not-allowed',
            )}
          >
            {visibleIndex === runner.visibleCards.length - 1
              ? t.onboarding.journey.common.finish
              : t.onboarding.journey.common.next}
          </button>
        </div>
      </footer>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function PhaseProgressBar({
  progress,
  phaseIndex,
}: {
  progress: number
  phaseIndex: number
}) {
  const total = JOURNEY_PHASES.length
  return (
    <div className="flex items-center gap-1.5" aria-valuenow={Math.round(progress * 100)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i <= phaseIndex
              ? 'bg-[var(--color-brand-red)]'
              : 'bg-[var(--color-brand-elevated)]',
          )}
        />
      ))}
    </div>
  )
}

function renderCardBody({
  card,
  value,
  onFieldChange,
}: {
  card: ReturnType<typeof useJourneyRunner>['currentCard'] & object
  value: unknown
  onFieldChange: (next: unknown) => void
}) {
  switch (card.kind) {
    case 'info':
      return <InfoCard card={card} />
    case 'field':
      return <FieldCard card={card} value={value} onChange={onFieldChange} />
    // Remaining kinds (multi, ai, review, terminal) are placeholders in
    // later commits. Rendering null here is safe because
    // `isCurrentComplete` defaults to true for unknown kinds — so the
    // Next button advances past unrendered cards rather than stranding.
    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function readByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let cursor: unknown = obj
  for (const p of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[p]
  }
  return cursor
}

function isFieldValuePresent(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}
