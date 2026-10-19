'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ListChecks, X } from 'lucide-react'
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
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { repairDraft } from '@/lib/budget/validate'
import {
  STAGES,
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
import { QuestionControl } from './QuestionControl'

const newId = () => crypto.randomUUID()

export interface StudioPageProps {
  intent: CreateIntent | null
  onClose: () => void
  /** The draft plan the studio built; `aiNote` is true when Buddgy's notes could not be added. */
  onBuilt: (planId: string, aiNote: boolean) => void
}

const confirmCount = (id: string, f: BudgetFacts, money: (n: number) => string): string =>
  id === 'confirmIncome' ? money(f.monthlyIncome)
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
  const building = useRef(false)

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

  const answer = (question: Question, value: unknown) => {
    const answered = applyAnswer(state, question.id, value)
    const { profile, financial } = answersToProfilePatch(answered)
    const s = store.getState()
    const patch: Record<string, unknown> = { ...profile }
    if (profile.emergencyFundConfig) patch.emergencyFundConfig = { ...s.profile.emergencyFundConfig, ...profile.emergencyFundConfig }
    if (Object.keys(financial).length > 0) patch.financialProfile = { ...s.profile.financialProfile, ...financial }
    if (Object.keys(patch).length > 0) s.updateProfile(patch)
    setSaved(question.writes.kind === 'profile' || question.writes.kind === 'financial')
    setFocusId(null)
    commit(answered)
  }

  useEffect(() => {
    if (next || focusId || building.current) return
    building.current = true
    const controller = new AbortController()
    void (async () => {
      const engine = buildPlan(merged)
      const ctx = (d: PlanDraft) => ({
        income: d.income,
        subscriptionsLive: merged.subscriptionsMonthly,
        debtMinimums: Object.fromEntries(merged.debts.map((x) => [x.id, x.minimum])),
        goalMonthly: Object.fromEntries(merged.goals.map((g) => [g.id, g.monthly])),
      })
      const base0 = repairDraft(engine, ctx(engine)).draft
      const refined = await refineDraft(merged, base0, controller.signal)
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
    })()
    return () => controller.abort()
    // The build runs once, when the last question is answered.
  }, [next, focusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const knownRows: KnownRow[] = QUESTIONS.filter(
    (x) => x.writes.kind !== 'none' && x.control !== 'confirm' && x.askIf(merged, state) && (x.id in state.answers || x.prefill(merged) != null),
  ).map((x) => {
    const copy = ui.q[x.id]
    return { id: x.id, label: copy?.label ?? x.id, value: formatKnown(x, defaultValue(x, facts, state), copy, ui, money) }
  })

  if (!q) return <BuildingScreen />

  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
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
        confirmN={q.control === 'confirm' ? confirmCount(q.id, merged, money) : ''}
        base={base}
        saved={saved}
        onAnswer={(v) => answer(q, v)}
        onSkip={() => {
          setFocusId(null)
          commit(skipQuestion(state, q.id))
        }}
      />
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
  if (typeof value === 'number') return x.id === 'income' || x.id === 'rent' || x.id === 'extraPayoff' ? money(value) : String(value)
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
  const copy = ui.q[q.id.startsWith('debtApr:') ? 'debtApr' : q.id] ?? { label: q.id, why: '' }
  const [value, setValue] = useState<unknown>(initial)
  const skippable = q.tier !== 'required' && q.control !== 'confirm'
  const ok =
    q.control === 'amount' ? typeof value === 'number' && value >= (q.control === 'amount' && q.id === 'income' ? 1 : 0)
      : q.control === 'chips' || q.control === 'single' ? value != null
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

function BuildingScreen() {
  const ui = useBudgetStudioCopy().building
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
        {ui.steps[step]}
      </p>
    </PageBody>
  )
}
