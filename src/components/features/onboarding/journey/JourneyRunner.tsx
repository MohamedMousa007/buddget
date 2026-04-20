'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useT } from '@/lib/i18n'
import { JOURNEY_EVENTS, track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { useJourneyRunner } from '@/hooks/useJourneyRunner'
import { JOURNEY_CARDS } from '@/lib/onboarding/journeyConfig'
import {
  JOURNEY_PHASES,
  type JourneyAnswers,
  type JourneyCard,
} from '@/lib/onboarding/journeyTypes'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'
import { InfoCard } from '@/components/features/onboarding/journey/cards/InfoCard'
import { FieldCard } from '@/components/features/onboarding/journey/cards/FieldCard'
import { OnboardingModalGate } from '@/components/features/onboarding/OnboardingModalGate'
import { OnboardingGateCard } from '@/components/features/onboarding/OnboardingGateCard'
import { BuddgyBubble } from '@/components/features/onboarding/BuddgyBubble'
import { BuildingPlanScreen } from '@/components/features/onboarding/BuildingPlanScreen'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'

/**
 * The conversational onboarding surface. Composes:
 *   - header: back button + phase-progress bar
 *   - Buddgy bubble above the active card (scripted, variable-aware)
 *   - card body (dispatch on `card.kind`)
 *   - sticky footer: Next / Finish
 *
 * State lives in `useJourneyRunner`; this component is presentational.
 * SP4 brings the full 18-card sequence online (behind the
 * `NEXT_PUBLIC_ONBOARDING_V3` flag). SP5 implements the terminal
 * `loading` card — for SP4 it's a friendly placeholder with a spinner.
 */
export function JourneyRunner() {
  const t = useT()
  const runner = useJourneyRunner({ cards: JOURNEY_CARDS })

  const {
    currentCard,
    visibleIndex,
    progress,
    answers,
    canGoBack,
    advance,
    back,
    setAnswer,
  } = runner

  // Bridge JourneyAnswers → BuddgyAnswers (subset the dialogue engine
  // needs). Keeps Buddgy decoupled from the wider answer schema.
  const buddgyAnswers = useMemo(() => buildBuddgyAnswers(answers), [answers])

  // Fire journey.abandoned_at on pagehide if the user leaves before the
  // terminal loading card. `pagehide` is the modern `unload` replacement
  // that also fires on mobile bfcache eviction. One-shot via ref so
  // React StrictMode can't double-emit.
  const abandonFiredRef = useRef(false)
  const journeyStartedAtRef = useRef<number | null>(null)
  useEffect(() => {
    if (journeyStartedAtRef.current === null) {
      journeyStartedAtRef.current = Date.now()
    }
    const handler = () => {
      if (abandonFiredRef.current) return
      if (!currentCard) return
      if (currentCard.kind === 'loading') return // terminal card = not abandoned
      abandonFiredRef.current = true
      const startedAt = journeyStartedAtRef.current ?? Date.now()
      track(JOURNEY_EVENTS.abandonedAt, {
        cardId: currentCard.id,
        totalDurationMs: Date.now() - startedAt,
      })
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [currentCard])

  // The Field cards read + write through `setAnswer(path, value)`; for
  // other kinds we derive a no-op.
  const currentValue = useMemo(() => {
    if (!currentCard) return undefined
    if (currentCard.kind === 'field') return readByPath(answers, currentCard.writeKey)
    if (currentCard.kind === 'gate') return readByPath(answers, currentCard.writeKey)
    return undefined
  }, [currentCard, answers])

  const handleFieldChange = useCallback(
    (next: unknown) => {
      if (!currentCard || currentCard.kind !== 'field') return
      setAnswer(currentCard.writeKey, next)
    },
    [currentCard, setAnswer],
  )

  const handleGateChange = useCallback(
    (next: 'yes' | 'no') => {
      if (!currentCard || currentCard.kind !== 'gate') return
      setAnswer(currentCard.writeKey, next)
    },
    [currentCard, setAnswer],
  )

  // Country → auto-derive primary currency the first time the currency
  // card opens if the user hasn't explicitly picked one yet.
  useEffect(() => {
    if (currentCard?.id !== 'identity.currency') return
    if (answers.identity.baseCurrency) return
    if (!answers.identity.country) return
    const derived = defaultCurrencyForCountry(
      answers.identity.country,
      answers.identity.city,
    )
    if (derived) setAnswer('identity.baseCurrency', derived)
  }, [
    currentCard?.id,
    answers.identity.country,
    answers.identity.city,
    answers.identity.baseCurrency,
    setAnswer,
  ])

  // Modal cards consult the live Zustand store to know how many rows of
  // the entity exist — that's the completion gate (not a field value).
  const modalEntityCount = useFinanceStore(
    useShallow((s) => {
      if (!currentCard || currentCard.kind !== 'modal') return 0
      switch (currentCard.entity) {
        case 'paymentMethods':
          return s.paymentMethods.length
        case 'incomeSources':
          return s.incomeSources.length
        case 'debts':
          return s.debts.length
        case 'subscriptions':
          return s.subscriptions.length
        case 'savingsAccounts':
          return s.savingsAccounts.length
        case 'goals':
          return s.goals.length
      }
    }),
  )

  const isCurrentComplete = useMemo(() => {
    if (!currentCard) return false
    switch (currentCard.kind) {
      case 'info':
        return true
      case 'field':
        return currentCard.optional === true || isFieldValuePresent(currentValue)
      case 'gate':
        return isFieldValuePresent(currentValue)
      case 'modal':
        return modalEntityCount >= currentCard.minEntries
      case 'loading':
      case 'ai':
      case 'review':
      case 'terminal':
        // These kinds gate advance on their own internal state (SP5).
        return false
    }
  }, [currentCard, currentValue, modalEntityCount])

  if (!currentCard) return null

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

      {/* Buddgy bubble + active card body */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto w-full max-w-xl space-y-5">
          {/* Buddgy speaks on every card that declares a buddgyKey or
              implicitly derives one from the card id (see
              `cardBuddgyKey` helper). */}
          <BuddgyBubble
            cardId={cardBuddgyKey(currentCard) ?? 'welcomeIntro'}
            answers={buddgyAnswers}
          />

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
                onGateChange: handleGateChange,
                onContinueRequested: advance,
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      {currentCard.kind === 'modal' ? (
        // Modal card renders its own Continue button inside the
        // OnboardingModalGate (coupled with Add another). No separate
        // footer button.
        null
      ) : (
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
      )}
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
  onGateChange,
  onContinueRequested,
}: {
  card: JourneyCard
  value: unknown
  onFieldChange: (next: unknown) => void
  onGateChange: (next: 'yes' | 'no') => void
  onContinueRequested: () => void
}) {
  switch (card.kind) {
    case 'info':
      return <InfoCard card={card} />
    case 'field':
      return <FieldCard card={card} value={value} onChange={onFieldChange} />
    case 'gate':
      return (
        <OnboardingGateCard
          card={card}
          value={value as 'yes' | 'no' | undefined}
          onChange={onGateChange}
        />
      )
    case 'modal':
      return <OnboardingModalGate card={card} onContinueRequested={onContinueRequested} />
    case 'loading':
      return <BuildingPlanScreen />

    case 'ai':
    case 'review':
    case 'terminal':
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

/** Extract the Buddgy-relevant subset from the full JourneyAnswers. */
function buildBuddgyAnswers(answers: JourneyAnswers): import('@/lib/onboarding/buddgyScript').BuddgyAnswers {
  return {
    name: answers.identity.displayName,
    country: answers.identity.country,
    city: answers.identity.city,
    baseCurrency: answers.identity.baseCurrency,
    household: answers.identity.household,
    firstPaymentMethodName: answers.moneyIn.paymentMethods[0]?.name,
    incomeCurrency: answers.moneyIn.incomeSources[0]?.currency,
  }
}

/** Derive a BuddgyCardId from the card. Preference order:
 *  explicit `buddgyKey` field → hard-coded id → null (no bubble). */
function cardBuddgyKey(
  card: JourneyCard,
): import('@/lib/onboarding/buddgyScript').BuddgyCardId | null {
  if ('buddgyKey' in card && card.buddgyKey) return card.buddgyKey
  // Implicit mapping for field/info cards without an explicit key.
  switch (card.id) {
    case 'welcome.intro':
      return 'welcomeIntro'
    case 'identity.name':
      return 'identityName'
    case 'identity.country':
      return 'identityCountry'
    case 'identity.city':
      return 'identityCity'
    case 'identity.currency':
      return 'identityCurrency'
    case 'identity.household':
      return 'identityHousehold'
    case 'identity.intro':
      return null
    case 'money.pm.intro':
      return 'moneyInPmIntro'
    default:
      return null
  }
}
