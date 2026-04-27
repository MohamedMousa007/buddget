'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useAnchorRegistry } from '@/components/tutorial/TutorialAnchor'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import {
  advance,
  buildResumeMarker,
  createSession,
  currentStep,
  isAtEnd,
  isTourCompleted,
  parseResumeMarker,
  retreat,
  type TourSession,
  type TourStatus,
} from '@/lib/tutorial/tourRunner'
import { tourStorageKey, type TourId } from '@/lib/tutorial/anchorManifest'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'

/**
 * Runtime orchestration for the tutorial system.
 *
 * Responsibilities:
 *   - Resolve anchor ids → DOM refs via the shared registry.
 *   - Drive the overlay state machine (start / next / back / skip / pause).
 *   - Persist completion + resume markers to `user_settings` via the
 *     Zustand finance store (which handles the Supabase round-trip).
 *   - Navigate between routes for multi-route tours (noop in SP1 — the
 *     debug tour is single-route; SP6 enables cross-route support).
 *   - Auto-resume an in-progress tour when the app opens.
 *
 * This component is rendered once at the app root (`app/layout.tsx`).
 * Consumers use `useTutorial()` to start tours.
 */
interface TutorialContextValue {
  status: TourStatus
  activeTourId: TourId | null
  start: (tourId: TourId) => void
  skipAll: () => void
  isCompleted: (tourId: TourId) => boolean
}

const TutorialControllerContext = createContext<TutorialContextValue | null>(null)

export function useTutorialController(): TutorialContextValue {
  const ctx = useContext(TutorialControllerContext)
  if (!ctx) throw new Error('useTutorialController must be used inside <TutorialControllerRoot>')
  return ctx
}

export function TutorialControllerRoot({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const registry = useAnchorRegistry()
  const t = useT()

  const { tutorialsCompleted, tutorialCurrentStep, updateSettings } = useFinanceStore(
    useShallow((s) => ({
      tutorialsCompleted: s.settings.tutorialsCompleted,
      tutorialCurrentStep: s.settings.tutorialCurrentStep,
      updateSettings: s.updateSettings,
    })),
  )

  const [session, setSession] = useState<TourSession | null>(null)
  const [status, setStatus] = useState<TourStatus>('idle')
  const autoResumed = useRef(false)

  // Auto-resume disabled while the tutorial system is paused — see the
  // no-op `start()` below. Persisted resume markers are simply ignored;
  // they'll be cleared the next time we run the tour to completion.
  useEffect(() => {
    if (autoResumed.current) return
    autoResumed.current = true
    void parseResumeMarker
    void isTourCompleted
    void tutorialCurrentStep
    void tutorialsCompleted
  }, [tutorialCurrentStep, tutorialsCompleted])

  const persistMarker = useCallback(
    (next: TourSession | null) => {
      updateSettings({
        tutorialCurrentStep: next ? buildResumeMarker(next) : null,
      })
    },
    [updateSettings],
  )

  const start = useCallback(
    (tourId: TourId) => {
      // Tutorial system is disabled while we rework it. All start() calls
      // become no-ops; existing call sites (PostOnboardingTourBoot, modal
      // gates) keep working without changes. Re-enable by restoring the
      // implementation below once the overlay/anchor regressions are
      // addressed in a future sprint.
      void tourId
      void persistMarker
      void createSession
    },
    [persistMarker],
  )

  const completeTour = useCallback(
    (sess: TourSession) => {
      const key = tourStorageKey(sess.tourId)
      const already = tutorialsCompleted.includes(key)
      updateSettings({
        tutorialsCompleted: already ? tutorialsCompleted : [...tutorialsCompleted, key],
        tutorialCurrentStep: null,
      })
      setSession(null)
      setStatus('complete')
    },
    [tutorialsCompleted, updateSettings],
  )

  const skipAll = useCallback(() => {
    if (!session) {
      setStatus('idle')
      return
    }
    completeTour(session)
    // After a small beat, snap back to idle so future startTour calls work.
    setStatus('idle')
  }, [session, completeTour])

  const onNext = useCallback(() => {
    if (!session) return
    const currentEntry = currentStep(session)?.entry
    const nextSession = advance(session)
    if (isAtEnd(nextSession)) {
      completeTour(nextSession)
      return
    }
    setSession(nextSession)
    persistMarker(nextSession)

    // If the current step had `waitForTargetClick` (SP13), the user's
    // click on the target is already navigating them — don't double
    // up with router.push. For all other transitions, navigate if the
    // next step targets a different route.
    if (currentEntry?.waitForTargetClick) return
    const step = currentStep(nextSession)
    if (step?.entry.route && step.entry.route !== pathname) {
      router.push(step.entry.route)
    }
  }, [session, pathname, router, completeTour, persistMarker])

  const onBack = useCallback(() => {
    if (!session) return
    const prev = retreat(session)
    setSession(prev)
    persistMarker(prev)
  }, [session, persistMarker])

  const onSkipStep = useCallback(() => {
    // Same behaviour as Next — advance past this step without recording
    // it as "must not re-appear." The whole tour completion is recorded
    // only when the user reaches the end or taps "Skip tour."
    onNext()
  }, [onNext])

  const contextValue = useMemo<TutorialContextValue>(
    () => ({
      status,
      activeTourId: session?.tourId ?? null,
      start,
      skipAll,
      isCompleted: (tourId: TourId) => isTourCompleted(tourId, tutorialsCompleted),
    }),
    [status, session, start, skipAll, tutorialsCompleted],
  )

  // Resolve the current step's target ref from the registry. `null` while
  // the registry hasn't mounted an anchor with that id yet — the overlay
  // shows a full-screen dimmer while it waits.
  const activeStep = session ? currentStep(session) : null
  const targetRef = useMemo(() => {
    if (!activeStep || !registry) return { current: null as HTMLElement | null }
    const ref = registry.get(activeStep.anchorId)
    return ref ?? { current: null as HTMLElement | null }
  }, [activeStep, registry])

  // SP13: if the active step has `waitForTargetClick`, the tour advances
  // on the user's tap of the target instead of the Next button. Attach a
  // one-shot capture-phase click listener so it fires before any nested
  // handlers; the link's own navigation still runs and lands the user on
  // the right route, and onNext advances the tour in parallel.
  useEffect(() => {
    if (!activeStep || !activeStep.entry.waitForTargetClick) return
    const target = targetRef.current
    if (!target) return
    const handler = () => onNext()
    target.addEventListener('click', handler, { once: true, capture: true })
    return () => {
      target.removeEventListener('click', handler, true)
    }
  }, [activeStep, targetRef, onNext])

  // SP13: if the active step has a `copyResolver` that returns null, the
  // step is silently skipped. Schedule onNext in a microtask so we don't
  // re-render mid-mount.
  const resolvedCopy = useMemo<{ title: string; body: string } | null>(() => {
    if (!activeStep) return null
    const resolver = activeStep.entry.copyResolver
    if (resolver) {
      const storeSnapshot = useFinanceStore.getState()
      return resolver({ store: storeSnapshot, t })
    }
    const key = activeStep.entry.copyKey ?? 'tour.missing'
    return {
      title: readI18n(t, `${key}.title`),
      body: readI18n(t, `${key}.body`),
    }
  }, [activeStep, t])

  useEffect(() => {
    if (activeStep && activeStep.entry.copyResolver && resolvedCopy === null) {
      // Resolver returned null → user doesn't have the data this step
      // references (e.g. no debts). Skip to the next step.
      const id = window.setTimeout(() => onNext(), 0)
      return () => window.clearTimeout(id)
    }
  }, [activeStep, resolvedCopy, onNext])

  return (
    <TutorialControllerContext.Provider value={contextValue}>
      {children}
      {session && activeStep && status === 'running' && resolvedCopy !== null ? (
        <TutorialOverlay
          targetRef={targetRef}
          title={resolvedCopy.title}
          body={resolvedCopy.body}
          stepNumber={session.stepIndex + 1}
          totalSteps={session.steps.length}
          placement={activeStep.entry.placement ?? 'auto'}
          interactive={(activeStep.entry.interactive ?? false) || !!activeStep.entry.waitForTargetClick}
          isLastStep={session.stepIndex === session.steps.length - 1}
          canGoBack={session.stepIndex > 0}
          onNext={onNext}
          onBack={onBack}
          onSkipStep={onSkipStep}
          labels={{
            next: t.onboarding.journey.common.next,
            done: t.onboarding.journey.common.finish,
            back: t.onboarding.journey.common.back,
            skipStep: t.tutorialSkipConfirm.skipStep,
            progress: (current, total) =>
              t.onboarding.stepOfTotal(current, total),
          }}
        />
      ) : null}
    </TutorialControllerContext.Provider>
  )
}
