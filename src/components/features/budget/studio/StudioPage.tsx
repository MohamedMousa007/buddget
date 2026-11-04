'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ListChecks, X } from 'lucide-react'
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
import { commitFlowEntities, createdIds } from '@/lib/budget/studioEntities'
import { recordBuild } from '@/lib/budget/learnHooks'
import { isOnline } from '@/hooks/useNetworkStatus'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { repairDraft } from '@/lib/budget/validate'
import { acceptDescribed, answer, createFlow, flowReadiness, nextQuestion, pruneInapplicable, skip, STAGES, stageOf } from '@/lib/budget/flow/flow'
import { get } from '@/lib/budget/flow/derive'
import { knownFromStore } from '@/lib/budget/flow/known'
import { NODES, NODE_BY_ID } from '@/lib/budget/flow/nodes'
import { PROFILE_ANSWERS, profilePatch } from '@/lib/budget/flow/profile'
import { applyAnswers } from '@/lib/budget/flow/toFacts'
import type { FlowIntent, FlowState, FlowValue } from '@/lib/budget/flow/types'
import type { PlanDraft } from '@/lib/budget/facts'
import type { CreateIntent } from '@/lib/budget/templates'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { useBudgetPageCopy } from '../usePageCopy'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { KnownSheet, type KnownRow } from './KnownSheet'
import { OpenerStep } from './OpenerStep'
import { ScreenStep, type ScreenAnswer } from './ScreenStep'
import { UnderstoodStep } from './UnderstoodStep'

const newId = () => crypto.randomUUID()
const BUILD_TIMEOUT_MS = 30_000
const PERCENT_ANSWERS = new Set(['partnerSharePct', 'taxPct'])

export interface StudioPageProps {
  intent: CreateIntent | null
  onClose: () => void
  /** The draft plan the studio built; `aiNote` is true when Buddgy's notes could not be added. */
  onBuilt: (planId: string, aiNote: boolean) => void
}

/** Card-by-card builder: related questions share a screen, answers are saved to the profile as they land. */
export function StudioPage({ intent, onClose, onBuilt }: StudioPageProps) {
  const ui = useBudgetStudioCopy()
  const page = useBudgetPageCopy()
  const store = useFinanceStore
  const facts = useMemo(() => buildFactsFromStore(store.getState(), new Date()), [store])
  const [state, setState] = useState<FlowState>(
    () => resumeStudioDraft(useSettingsStore.getState().budgetStudioDraft, intent, Date.now()) ?? createFlow((intent ?? 'mixed') as FlowIntent, knownFromStore(facts, store.getState().profile.financialProfile)),
  )
  const [saved, setSaved] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [knownOpen, setKnownOpen] = useState(false)
  // The state before each screen, so Back restores it exactly.
  const [trail, setTrail] = useState<FlowState[]>([])
  const [attempt, setAttempt] = useState(0)
  const [buildNow, setBuildNow] = useState(false)
  const [understood, setUnderstood] = useState<string[] | null>(null)
  const [buildError, setBuildError] = useState(false)
  const building = useRef(false)
  // Held outside state so a remounted or retried build cannot create the same records again.
  const created = useRef<Record<string, string>>(state.entities ?? {})

  const base = facts.baseCurrency
  const money = (n: number) => formatCurrency(n, base, false)
  const next = nextQuestion(state)
  const head = (focusId ? NODE_BY_ID.get(focusId) : undefined) ?? next
  const ready = flowReadiness(state)

  const commit = (s: FlowState) => {
    useSettingsStore.getState().saveBudgetStudioDraft({ v: 3, intent, state: s, savedAt: Date.now() })
    setState(s)
  }

  /** Writes the answers that belong on the profile (household, rent, budget answers) as they land. */
  const saveToProfile = (a: FlowState['a']) => {
    const { profile, financial } = profilePatch(a)
    const s = store.getState()
    const patch: Record<string, unknown> = { ...profile }
    if (profile.emergencyFundConfig) patch.emergencyFundConfig = { ...s.profile.emergencyFundConfig, ...profile.emergencyFundConfig }
    if (Object.keys(financial).length > 0) patch.financialProfile = { ...s.profile.financialProfile, ...financial }
    if (Object.keys(patch).length > 0) s.updateProfile(patch)
  }

  const finishOpener = (described: Record<string, unknown>) => {
    const { state: after, kept } = acceptDescribed(state, described as Record<string, FlowValue>)
    saveToProfile(after.a)
    setUnderstood(kept.length > 0 ? kept : null)
    commit({ ...after, opener: 'done' })
  }

  const submit = (answers: ScreenAnswer[]) => {
    // Reopening a screen replaces its answers, so they are cleared first.
    const reopened = focusId !== null
    const ids = new Set(answers.map((x) => x.id))
    let after: FlowState = reopened
      ? { ...state, a: Object.fromEntries(Object.entries(state.a).filter(([k]) => !ids.has(k))), skipped: state.skipped.filter((k) => !ids.has(k)) }
      : state
    for (const x of answers) after = 'skip' in x ? skip(after, x.id) : answer(after, x.id, x.value)
    if (reopened) after = pruneInapplicable(after)
    saveToProfile(after.a)
    setSaved(answers.some((x) => PROFILE_ANSWERS.has(x.id)))
    if (!reopened) setTrail((t) => [...t, state])
    setFocusId(null)
    commit(after)
  }

  useEffect(() => {
    if ((next && !buildNow) || focusId || building.current) return
    building.current = true
    setBuildError(false)
    let cancelled = false
    const controller = new AbortController()
    // A model that never answers must not hold the build forever.
    const timer = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS)
    void (async () => {
      try {
        // What the user told us becomes real income, debt, goal and savings records first, so the plan links to them.
        const live = store.getState()
        created.current = {
          ...created.current,
          ...commitFlowEntities({ ...state, entities: created.current }, live, live.settings.baseCurrency, {
            income: ui.entities.income,
            savings: ui.entities.savings,
            debt: (id) => ui.entities.debts[id] ?? ui.entities.debts['answered-loan'],
            goal: (kind) => ui.entities.goals[kind] ?? ui.entities.goals.custom,
          }),
        }
        const committed: FlowState = { ...state, entities: created.current }
        commit(committed)
        // The plan uses the richer answered debts and goals (with their rates and dates), not the records just created from them.
        // Remembered answers and this run's answers are laid over the store facts together, once, so a partner share is never applied twice.
        const live2 = store.getState()
        const fresh = buildFactsFromStore(live2, new Date(), { remembered: false })
        const made = createdIds(created.current)
        const answers = { ...live2.profile.financialProfile?.budgetProfile, ...committed.a }
        const merged = applyAnswers({ ...fresh, debts: fresh.debts.filter((d) => !made.has(d.id)), goals: fresh.goals.filter((g) => !made.has(g.id)) }, answers, committed.intent)
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
        recordBuild(committed.a)
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

  const fill = (id: string) =>
    id === 'confirmIncome' ? money(Number(get(state, 'income')) || 0)
      : id === 'confirmBills' ? String(Number(state.known.knownBillCount ?? 0) + Number(state.known.knownSubCount ?? 0))
        : id === 'confirmDebts' ? String(state.known.knownDebtCount ?? 0)
          : String(state.known.knownGoalCount ?? 0)

  const formatKnown = (id: string, v: FlowValue): string => {
    const x = NODE_BY_ID.get(id)
    const copy = ui.q[id]
    if (Array.isArray(v)) return v.map((o) => copy?.opts?.[o] ?? o).join(', ') || '-'
    if (typeof v === 'boolean') return v ? ui.known.yes : ui.known.no
    if (typeof v === 'number') return x?.control === 'amount' ? money(v) : PERCENT_ANSWERS.has(id) ? `${v}%` : String(v)
    return copy?.opts?.[v] ?? v
  }

  const knownRows: KnownRow[] = NODES.filter((x) => x.control !== 'confirm' && x.needs === undefined && (x.when ? x.when(state) : true) && get(state, x.id) !== undefined).map((x) => ({
    id: x.id,
    label: ui.q[x.id]?.label ?? x.id,
    value: formatKnown(x.id, get(state, x.id) as FlowValue),
  }))

  const goBack = () => {
    const prev = trail.at(-1)
    if (!prev) return
    setTrail((t) => t.slice(0, -1))
    setFocusId(null)
    commit(prev)
  }

  const showOpener = !buildNow && !state.opener && !focusId && !understood && trail.length === 0 && isOnline()

  if (showOpener) {
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <div className="flex items-center gap-2">
          <IconButton variant="outlined" aria-label={ui.close} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <OpenerStep base={base} onDone={finishOpener} />
      </PageBody>
    )
  }

  if (understood) {
    const rows: KnownRow[] = understood.flatMap((id) => {
      if (id === 'commitments') {
        return (state.a.commitments as string[]).map((c) => {
          const [name, amount] = c.split('|')
          return { id: `commitment:${name}`, label: name, value: money(Number(amount)) }
        })
      }
      const v = state.a[id]
      return v === undefined ? [] : [{ id, label: ui.q[id]?.label ?? id, value: formatKnown(id, v) }]
    })
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <UnderstoodStep rows={rows} onContinue={() => setUnderstood(null)} />
      </PageBody>
    )
  }

  if (!head || (buildNow && !focusId)) {
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

  const stage = stageOf(head.mod)
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
                style={{ background: STAGES.indexOf(s) <= STAGES.indexOf(stage) ? 'var(--color-brand-primary)' : 'var(--color-brand-elevated)' }}
              />
            ))}
          </div>
        </div>
        <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{ui.progress(ready.percent)}</span>
        <IconButton variant="outlined" aria-label={ui.known.open} onClick={() => setKnownOpen(true)}>
          <ListChecks />
        </IconButton>
      </div>

      <ScreenStep
        key={`${head.group}:${focusId ?? ''}:${state.cursor}:${trail.length}`}
        state={state}
        head={head}
        reopen={focusId !== null}
        base={base}
        saved={saved}
        fill={fill}
        onSubmit={submit}
      />
      {ready.enough && next && trail.length > 0 ? (
        <Button size="touch" variant="ghost" className="w-full" onClick={() => setBuildNow(true)}>
          {ui.buildNow(ready.percent)}
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
      <h2 className="text-xl font-bold text-[var(--color-brand-text-primary)]">{ui.title}</h2>
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
