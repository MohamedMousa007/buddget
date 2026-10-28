'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ListChecks, X } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { PageBody } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { resumeStudioDraft } from '@/lib/budget/studioDraft'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { buildPlan, ENGINE_VERSION } from '@/lib/budget/engine'
import { refineDraft } from '@/lib/budget/budgetAiClient'
import { applyRefinement } from '@/lib/budget/budgetAi'
import { commitStudioEntities } from '@/lib/budget/studioEntities'
import { isOnline } from '@/hooks/useNetworkStatus'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { repairDraft } from '@/lib/budget/validate'
import {
  STAGES,
  acceptDescribed,
  answersToProfilePatch,
  applyAnswer,
  createState,
  defaultValue,
  mergeFacts,
  QUESTIONS,
  questionById,
  readiness,
  skipQuestion,
  visibleQuestions,
  type Question,
  type StudioState,
} from '@/lib/budget/infoGaps'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'
import type { CreateIntent } from '@/lib/budget/templates'
import { INTENT_PRIORITIES } from '@/lib/budget/templates'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { useBudgetPageCopy } from '../usePageCopy'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { KnownSheet, type KnownRow } from './KnownSheet'
import { incomeKnownRow } from './incomeKnownRow'
import { DraftStep } from './DraftStep'
import { OpenerStep } from './OpenerStep'
import { QuestionControl } from './QuestionControl'
import { UnderstoodStep } from './UnderstoodStep'

const newId = () => crypto.randomUUID()

export interface StudioPageProps {
  intent: CreateIntent | null
  onClose: () => void
  /** The draft plan the studio built; `aiNote` is true when Buddgy's notes could not be added. */
  onBuilt: (planId: string, aiNote: boolean) => void
}

const MONEY_ANSWERS = new Set(['income', 'rent', 'lowMonth', 'debtTotal', 'debtMonthly', 'savingsOnHand', 'goalTarget'])

const labelArg = (id: string, f: BudgetFacts, money: (n: number) => string): string =>
  id === 'rentCheck' ? money(f.ledgerRent ?? 0)
  : id === 'confirmIncome' ? money(f.monthlyIncome)
    : id === 'confirmBills' ? String(f.bills.length + f.subscriptionCount)
      : id === 'confirmDebts' ? String(f.debts.length)
        : String(f.goals.length)

/** Card-by-card builder: one question at a time, answers saved to the profile as they land. */
export function StudioPage({ intent, onClose, onBuilt }: StudioPageProps) {
  const ui = useBudgetStudioCopy()
  const page = useBudgetPageCopy()
  const store = useFinanceStore
  const facts = useMemo(() => buildFactsFromStore(store.getState(), new Date()), [store])
  const [state, setState] = useState<StudioState>(() => {
    const resumed = resumeStudioDraft(useSettingsStore.getState().budgetStudioDraft, intent, Date.now())
    if (resumed) return resumed
    const s = createState()
    return intent && INTENT_PRIORITIES[intent] ? applyAnswer(s, 'priorities', INTENT_PRIORITIES[intent]) : s
  })
  const [saved, setSaved] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [knownOpen, setKnownOpen] = useState(false)
  // Question ids answered or skipped this session, newest last, so Back can undo them one by one.
  const [trail, setTrail] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [buildNow, setBuildNow] = useState(false)
  // Answer ids Buddgy picked out of the description, shown once before the remaining questions.
  // Someone with history can build straight from it; this records that they chose the questions instead.
  const [draftDeclined, setDraftDeclined] = useState(false)
  const [understood, setUnderstood] = useState<string[] | null>(null)
  const [buildError, setBuildError] = useState(false)
  const building = useRef(false)
  // Held outside state so a remounted or retried build cannot create the same records again.
  const created = useRef<Record<string, string>>(state.entities ?? {})

  const next = visibleQuestions(facts, state)[0]
  // A row picked in "What I know" reopens its question even though it is already answered.
  const q = (focusId ? questionById(focusId) : undefined) ?? next
  const merged = mergeFacts(facts, state)
  const ready = readiness(facts, state)
  const base = facts.baseCurrency
  const stage = q?.stage ?? 'priorities'
  const money = (n: number) => formatCurrency(n, base, false)

  const commit = (next: StudioState) => {
    useSettingsStore.getState().saveBudgetStudioDraft({ intent, state: next, savedAt: Date.now() })
    setState(next)
  }

  /** Writes the answers that belong on the profile (household, rent, budget answers) as they land. */
  const saveToProfile = (answered: StudioState) => {
    const { profile, financial } = answersToProfilePatch(answered, facts)
    const s = store.getState()
    const patch: Record<string, unknown> = { ...profile }
    if (profile.emergencyFundConfig) patch.emergencyFundConfig = { ...s.profile.emergencyFundConfig, ...profile.emergencyFundConfig }
    if (Object.keys(financial).length > 0) patch.financialProfile = { ...s.profile.financialProfile, ...financial }
    if (Object.keys(patch).length > 0) s.updateProfile(patch)
  }

  const finishOpener = (described: Record<string, unknown>) => {
    const found = acceptDescribed(facts, state, described)
    const start: StudioState = { ...state, opener: 'done' }
    const answered = Object.entries(found).reduce((acc, [id, v]) => applyAnswer(acc, id, v), start)
    saveToProfile(answered)
    setUnderstood(Object.keys(found).length > 0 ? Object.keys(found) : null)
    commit(answered)
  }

  const answer = (question: Question, value: unknown) => {
    const answered = applyAnswer(state, question.id, value)
    saveToProfile(answered)
    setSaved(question.writes.kind === 'profile' || question.writes.kind === 'financial')
    setTrail((t) => [...t, question.id])
    setFocusId(null)
    commit(answered)
  }

  useEffect(() => {
    if ((next && !buildNow) || focusId || building.current) return
    building.current = true
    setBuildError(false)
    let cancelled = false
    const controller = new AbortController()
    // A model that never answers must not hold the build forever.
    const timer = setTimeout(() => controller.abort(), 30_000)
    void (async () => {
      try {
      // What the user told us becomes real income, debt, goal and savings records first, so the plan links to them.
      const live = store.getState()
      created.current = {
        ...created.current,
        ...commitStudioEntities({ ...state, entities: created.current }, live, live.settings.baseCurrency, {
          income: ui.entities.income, debt: ui.entities.debt, savings: ui.entities.savings,
          goal: (kind) => ui.entities.goals[kind] ?? ui.entities.goals.custom,
        }),
      }
      const committed = { ...state, entities: created.current }
      commit(committed)
      const merged = mergeFacts(buildFactsFromStore(store.getState(), new Date()), committed)
      const engine = buildPlan(merged)
      const ctx = (d: PlanDraft) => ({
        income: d.income,
        subscriptionsLive: merged.subscriptionsMonthly,
        debtMinimums: Object.fromEntries(merged.debts.map((x) => [x.id, x.minimum])),
        goalMonthly: Object.fromEntries(merged.goals.map((g) => [g.id, g.monthly])),
      })
      const base0 = repairDraft(engine, ctx(engine)).draft
      const refined = await refineDraft(merged, base0, controller.signal)
      if (cancelled) return
      const folded = refined.ok ? applyRefinement(base0, refined.data) : null
      const final = folded ? repairDraft(folded, ctx(folded)).draft : base0
      const s = store.getState()
      const id = s.addBudgetPlan(page.planNames.fresh, {
        status: 'draft',
        origin: 'ai',
        intent: final.intent,
        rationale: { reasons: final.reasons, risks: final.risks },
        engineVersion: ENGINE_VERSION,
      })
      s.updateBudgetPlan(id, { categories: draftToCategories(final, newId, s.settings.baseCurrency) })
      useSettingsStore.getState().clearBudgetStudioDraft()
      onBuilt(id, !folded)
      } catch {
        if (!cancelled) setBuildError(true)
      } finally {
        clearTimeout(timer)
      }
    })()
    return () => {
      // Leaving mid-build must not create a plan afterwards, and a remount may start the build again.
      cancelled = true
      building.current = false
      controller.abort()
      clearTimeout(timer)
    }
    // The build runs when the last question is answered, and again on retry.
  }, [next, focusId, attempt, buildNow]) // eslint-disable-line react-hooks/exhaustive-deps

  const knownRows: KnownRow[] = [...incomeKnownRow(merged, state, ui.known.income, money), ...QUESTIONS.filter(
    (x) => x.writes.kind !== 'none' && x.control !== 'confirm' && x.askIf(merged, state) && (x.id in state.answers || x.prefill(merged) != null),
  ).map((x) => {
    const copy = ui.q[x.id]
    return { id: x.id, label: copy?.label ?? x.id, value: formatKnown(x, defaultValue(x, facts, state), copy, ui, money) }
  })]

  const goBack = () => {
    const last = trail.at(-1)
    if (!last) return
    setTrail((t) => t.slice(0, -1))
    setFocusId(last)
    commit({ ...state, answers: Object.fromEntries(Object.entries(state.answers).filter(([k]) => k !== last)), skipped: state.skipped.filter((k) => k !== last) })
  }

  const draftMonths = facts.averageCycles ?? 0
  const showDraft =
    !buildNow && !draftDeclined && !state.opener && !focusId && trail.length === 0 && Object.keys(state.answers).length === 0 && state.skipped.length === 0 &&
    draftMonths > 0 && facts.monthlyIncome > 0

  if (showDraft) {
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <div className="flex items-center gap-2">
          <IconButton variant="outlined" aria-label={ui.close} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <DraftStep months={draftMonths} onReview={() => setBuildNow(true)} onQuestions={() => setDraftDeclined(true)} />
      </PageBody>
    )
  }

  // The describe-yourself step is only worth showing to someone with plenty left to answer, and only when it can work.
  const showOpener =
    !buildNow && !state.opener && !focusId && !understood && trail.length === 0 && Object.keys(state.answers).length === 0 && isOnline() &&
    visibleQuestions(facts, state).filter((x) => x.control !== 'confirm').length >= 4

  if (showOpener) {
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <div className="flex items-center gap-2">
          <IconButton variant="outlined" aria-label={ui.close} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <OpenerStep base={base} onDone={finishOpener} onSkip={() => commit({ ...state, opener: 'done' })} />
      </PageBody>
    )
  }

  if (understood) {
    const rows: KnownRow[] = understood.flatMap((id) => {
      if (id === 'commitments') {
        return (state.answers.commitments as Array<{ name: string; amount: number }>).map((c) => ({ id: `commitment:${c.name}`, label: c.name, value: money(c.amount) }))
      }
      const x = questionById(id)
      if (!x || !(id in state.answers)) return []
      const copy = ui.q[id]
      return [{ id, label: copy?.label ?? id, value: formatKnown(x, state.answers[id], copy, ui, money) }]
    })
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <UnderstoodStep rows={rows} onContinue={() => setUnderstood(null)} />
      </PageBody>
    )
  }

  if (!q || (buildNow && !focusId)) {
    return (
      <BuildingScreen
        error={buildError}
        onRetry={() => {
          building.current = false
          setAttempt((a) => a + 1)
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        {trail.length > 0 ? (
          <IconButton variant="outlined" aria-label={ui.back} onClick={goBack}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
        ) : null}
        <IconButton variant="outlined" aria-label={ui.close} onClick={onClose}>
          <X />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className={microClassName}>{ui.stages[stage]}</p>
          <div className="mt-1 flex gap-1" aria-hidden>
            {STAGES.map((s) => (
              <span
                key={s}
                className="h-1 flex-1 rounded-full"
                style={{
                  background: STAGES.indexOf(s) <= STAGES.indexOf(stage) ? 'var(--color-brand-primary)' : 'var(--color-brand-elevated)',
                }}
              />
            ))}
          </div>
        </div>
        <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{ui.progress(ready.percent)}</span>
        <IconButton variant="outlined" aria-label={ui.known.open} onClick={() => setKnownOpen(true)}>
          <ListChecks />
        </IconButton>
      </div>

      <QuestionStep
        key={q.id}
        question={q}
        initial={defaultValue(q, facts, state)}
        confirmN={labelArg(q.id, merged, money)}
        base={base}
        saved={saved}
        onAnswer={(v) => answer(q, v)}
        onSkip={() => {
          setTrail((t) => [...t, q.id])
          setFocusId(null)
          commit(skipQuestion(state, q.id))
        }}
      />
      {ready.enough && next && trail.length > 0 ? (
        <Button size="touch" variant="ghost" className="w-full" onClick={() => setBuildNow(true)}>
          {ui.buildNow}
        </Button>
      ) : null}
      <KnownSheet
        open={knownOpen}
        rows={knownRows}
        onPick={(id) => {
          setKnownOpen(false)
          setFocusId(id)
        }}
        onClose={() => setKnownOpen(false)}
      />
    </PageBody>
  )
}

function formatKnown(
  x: Question,
  value: unknown,
  copy: { opts?: Record<string, string> } | undefined,
  ui: ReturnType<typeof useBudgetStudioCopy>,
  money: (n: number) => string,
): string {
  if (value == null) return '-'
  if (Array.isArray(value)) return value.map((v) => copy?.opts?.[String(v)] ?? String(v)).join(', ') || '-'
  if (typeof value === 'boolean') return value ? ui.known.yes : ui.known.no
  if (typeof value === 'number') return MONEY_ANSWERS.has(x.id) ? money(value) : String(value)
  return copy?.opts?.[String(value)] ?? String(value)
}

interface StepProps {
  question: Question
  initial: unknown
  confirmN: string
  base: BudgetFacts['baseCurrency']
  saved: boolean
  onAnswer: (v: unknown) => void
  onSkip: () => void
}

function QuestionStep({ question: q, initial, confirmN, base, saved, onAnswer, onSkip }: StepProps) {
  const ui = useBudgetStudioCopy()
  const copy = ui.q[q.id] ?? { label: q.id, why: '' }
  const [value, setValue] = useState<unknown>(initial)
  const skippable = q.tier !== 'required' && q.control !== 'confirm'
  const ok =
    q.control === 'amount' ? typeof value === 'number' && value >= (q.control === 'amount' && q.id === 'income' ? 1 : 0)
      : q.control === 'chips' || q.control === 'single' ? value != null
        : q.control === 'toggle' ? typeof value === 'boolean'
          : true

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3">
        <BuddgyIcon mood="curious" size={44} />
        <p className={`${microClassName} pb-1`}>{ui.buddgyAsks}</p>
      </div>
      <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
        {copy.label.replace('{n}', confirmN)}
      </h1>
      <p className="text-[13.5px] text-[var(--color-brand-text-secondary)]">
        <span className="font-semibold">{ui.why}: </span>
        {copy.why}
      </p>

      <QuestionControl
        question={q}
        copy={copy}
        ui={ui}
        base={base}
        value={value}
        onChange={(v) => (q.control === 'confirm' ? onAnswer(v) : setValue(v))}
      />

      {saved ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-brand-green)]">
          <Check className="size-3.5" aria-hidden />
          {ui.saved}
        </p>
      ) : null}

      {q.control !== 'confirm' ? (
        <div className="flex flex-col gap-2">
          <Button size="cta" className="w-full" disabled={!ok} onClick={() => onAnswer(value)}>
            {ui.cont}
          </Button>
          {skippable ? (
            <Button size="touch" variant="ghost" className="w-full" onClick={onSkip}>
              {ui.estimate}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function BuildingScreen({ error, onRetry, onClose }: { error: boolean; onRetry: () => void; onClose: () => void }) {
  const copy = useBudgetStudioCopy()
  const ui = copy.building
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, ui.steps.length - 1)), 2200)
    return () => clearInterval(t)
  }, [ui.steps.length])
  return (
    <PageBody className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <BuddgyIcon mood="thinking" size={88} />
      <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{ui.title}</h1>
      <p className="text-sm text-[var(--color-brand-text-secondary)]" aria-live="polite">
        {error ? ui.error : ui.steps[step]}
      </p>
      {error ? (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button size="cta" className="w-full" onClick={onRetry}>
            {ui.retry}
          </Button>
          <Button size="touch" variant="ghost" className="w-full" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      ) : null}
    </PageBody>
  )
}
