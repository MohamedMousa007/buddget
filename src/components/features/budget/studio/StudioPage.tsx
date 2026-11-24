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
import { ENGINE_VERSION } from '@/lib/budget/engine'
import { refineDraft } from '@/lib/budget/budgetAiClient'
import { applyRefinement } from '@/lib/budget/budgetAi'
import { commitFlowEntities, createdIds, relinkDraft } from '@/lib/budget/studioEntities'
import { recordBuild } from '@/lib/budget/learnHooks'
import { isOnline } from '@/hooks/useNetworkStatus'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { repairDraft } from '@/lib/budget/validate'
import { draftContext, engineDraft, studioFacts } from '@/lib/budget/studioPreview'
import { applyScreen, createFlow, flowReadiness, nextQuestion, STAGES, stageOf, type ScreenAnswer } from '@/lib/budget/flow/flow'
import { choose, nextConflict, pendingFor, resolveDescription } from '@/lib/budget/flow/conflicts'
import { get } from '@/lib/budget/flow/derive'
import { knownFromStore, knownSources } from '@/lib/budget/flow/known'
import { toBaseCurrency } from '@/lib/budget/situationAi'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { isTracked } from '@/lib/accounts/kinds'
import { NODES, NODE_BY_ID } from '@/lib/budget/flow/nodes'
import { PROFILE_ANSWERS, profilePatch } from '@/lib/budget/flow/profile'
import type { ConflictChoice, FlowConflict, FlowIntent, FlowState, FlowValue, PendingDescription } from '@/lib/budget/flow/types'
import type { CreateIntent } from '@/lib/budget/templates'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { useBudgetPageCopy } from '../usePageCopy'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { CommitmentSheet } from './CommitmentSheet'
import { ConflictStep } from './ConflictStep'
import { KnownSheet, type KnownRow } from './KnownSheet'
import { OpenerStep } from './OpenerStep'
import { ScreenStep } from './ScreenStep'
import { UnderstoodStep } from './UnderstoodStep'

const newId = () => crypto.randomUUID()
const BUILD_TIMEOUT_MS = 30_000
const PERCENT_ANSWERS = new Set(['partnerSharePct', 'taxPct'])

interface Understood {
  /** Answers taken from the description, then values it matched or the person kept from their records. */
  ids: string[]
  kept: string[]
  dropped: string[]
  unconverted?: string
}

/** A described cost or holding, which has no question of its own: edited in place. */
type ExtraKey = 'commitments' | 'holdings' | 'utilities'
interface ExtraRef { key: ExtraKey; index: number }
const EXTRA_KEYS: readonly string[] = ['commitments', 'holdings', 'utilities']
const asList = (v: FlowValue | undefined): string[] => (Array.isArray(v) ? v : [])

export interface StudioPageProps {
  intent: CreateIntent | null
  /** Answers collected in the Buddgy chat: the studio starts on them and builds at once. */
  handover?: FlowState
  onClose: () => void
  /** The draft plan the studio built; `aiNote` is true when Buddgy's notes could not be added. */
  onBuilt: (planId: string, aiNote: boolean) => void
}

/** Card-by-card builder: related questions share a screen, answers are saved to the profile as they land. */
export function StudioPage({ intent, handover, onClose, onBuilt }: StudioPageProps) {
  const ui = useBudgetStudioCopy()
  const page = useBudgetPageCopy()
  const store = useFinanceStore
  const facts = useMemo(() => buildFactsFromStore(store.getState(), new Date()), [store])
  const [state, setState] = useState<FlowState>(
    () => handover ?? resumeStudioDraft(useSettingsStore.getState().budgetStudioDraft, intent, Date.now()) ?? createFlow((intent ?? 'mixed') as FlowIntent, knownFromStore(facts, store.getState().profile.financialProfile, store.getState().paymentMethods.some(isTracked))),
  )
  const [saved, setSaved] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [knownOpen, setKnownOpen] = useState(false)
  // The state before each screen, so Back restores it exactly.
  const [trail, setTrail] = useState<FlowState[]>([])
  const [attempt, setAttempt] = useState(0)
  const [buildNow, setBuildNow] = useState(handover !== undefined)
  // What the description gave, shown once after the opener; kept while one of its lines is being changed.
  const [understood, setUnderstood] = useState<Understood | null>(null)
  const [editing, setEditing] = useState<ExtraRef | null>(null)
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

  /** Lays a description (with any choices made) onto the run and shows what was picked up. */
  const land = (s: FlowState, p: PendingDescription) => {
    const { state: after, kept, dropped, keptApp, keptRecords } = resolveDescription(s, p)
    saveToProfile(after.a)
    setUnderstood({ ids: [...kept, ...keptApp], kept: keptRecords, dropped, unconverted: p.unconverted })
    commit({ ...after, opener: 'done' })
  }

  /**
   * The description, in the plan's currency. When it disagrees with what the app holds, the run waits on the person's
   * choice (saved in the draft, so a restart asks again) instead of picking one. Returns false when nothing was usable.
   */
  const finishOpener = (described: Record<string, unknown>): boolean => {
    const rates = store.getState().exchangeRates
    const { found, unconverted } = toBaseCurrency(described as Record<string, FlowValue>, base, (n, from) => tryConvertCurrency(n, from, base, rates))
    const pending = pendingFor(state, found, knownSources(facts, store.getState().profile.financialProfile, store.getState().paymentMethods.some(isTracked)), unconverted)
    if (pending) {
      commit({ ...state, pending })
      return true
    }
    const plain: PendingDescription = { found, conflicts: [], choices: {}, ...(unconverted ? { unconverted } : {}) }
    const preview = resolveDescription(state, plain)
    if (preview.kept.length + preview.keptApp.length + preview.dropped.length === 0 && !unconverted) return false
    land(state, plain)
    return true
  }

  const pickConflict = (id: string, choice: ConflictChoice) => {
    if (!state.pending) return
    const p = choose(state.pending, id, choice)
    if (nextConflict(p)) commit({ ...state, pending: p })
    else land(state, p)
  }

  const backConflict = () => {
    const p = state.pending
    if (!p) return
    const answered = p.conflicts.filter((c) => p.choices[c.id] !== undefined)
    const last = answered.at(-1)
    if (!last) return
    const choices = { ...p.choices }
    delete choices[last.id]
    commit({ ...state, pending: { ...p, choices } })
  }

  const saveExtra = (ref: ExtraRef, next: { name: string; amount: number } | null) => {
    const a = { ...state.a }
    if (ref.key === 'utilities') {
      if (next) a.utilities = next.amount
      else delete a.utilities
    } else {
      const list = asList(a[ref.key])
      const kind = list[ref.index]?.split('|')[0] ?? ''
      const updated = next ? list.map((x, i) => (i === ref.index ? `${ref.key === 'holdings' ? kind : next.name}|${next.amount}` : x)) : list.filter((_, i) => i !== ref.index)
      if (updated.length > 0) a[ref.key] = updated
      else delete a[ref.key]
    }
    setEditing(null)
    commit({ ...state, a })
  }

  // The chat never writes the profile; the answers it handed over land here, once, as the builder's own screens would.
  useEffect(() => {
    if (handover) saveToProfile(handover.a)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (answers: ScreenAnswer[]) => {
    const reopened = focusId !== null
    const after = applyScreen(state, answers, reopened)
    saveToProfile(after.a)
    setSaved(answers.some((x) => PROFILE_ANSWERS.has(x.id)))
    if (!reopened) setTrail((t) => [...t, state])
    setFocusId(null)
    commit(after)
  }

  useEffect(() => {
    // Never while the person is still choosing or reviewing what the description gave: their changes would miss the build.
    if ((next && !buildNow) || focusId || understood || state.pending || building.current) return
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
        const merged = studioFacts(store.getState(), committed.a, committed.intent, createdIds(created.current))
        const base0 = engineDraft(merged)
        const refined = await refineDraft(merged, base0, controller.signal)
        if (cancelled) return
        const folded = refined.ok ? applyRefinement(base0, refined.data) : null
        const final = relinkDraft(folded ? repairDraft(folded, draftContext(merged, folded)).draft : base0, created.current)
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
  }, [next, focusId, attempt, buildNow, understood, state.pending]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /** The two sides of a conflict as the person reads them. */
  const conflictView = (c: FlowConflict, found: Record<string, FlowValue>) => {
    const cc = ui.conflict
    const n = Number(c.app) || 0
    const app = (value: string) => ({ value, source: c.source === 'earlier' ? cc.earlier : cc.tracked })
    const typed = (value: string) => ({ value, source: cc.typed })
    if (c.id === 'hasDebts') return { title: cc.debtsTitle, app: app(cc.debtsApp(n)), typed: typed(cc.debtsNone) }
    if (c.id === 'moreDebts') return { title: cc.moreDebtsTitle, app: app(cc.moreDebtsSame(n)), typed: typed(cc.moreDebtsExtra(formatKnown('debtKinds', c.typed))) }
    if (c.id === 'hasGoal') return { title: cc.goalsTitle, app: app(cc.goalsApp(n)), typed: typed(cc.goalsNone) }
    const freq = c.id === 'rent' && typeof found.rentFreq === 'string' && found.rentFreq !== 'monthly' ? ui.q.rentFreq?.opts?.[found.rentFreq] : undefined
    const typedValue = formatKnown(c.id, c.typed)
    return { title: cc.title(ui.q[c.id]?.label ?? c.id), app: app(formatKnown(c.id, c.app)), typed: typed(freq ? `${typedValue}, ${freq}` : typedValue) }
  }

  const extraDraft = (ref: ExtraRef) => {
    if (ref.key === 'utilities') return { name: ui.opener.utilities, nameEditable: false, amount: Number(state.a.utilities) || 0 }
    const [name = '', amount = '0'] = (asList(state.a[ref.key])[ref.index] ?? '').split('|')
    const label = ref.key === 'holdings' ? (ui.opener.holdings[name as keyof typeof ui.opener.holdings] ?? name) : name
    return { name: label, nameEditable: ref.key === 'commitments', amount: Number(amount) || 0, total: ref.key === 'holdings' }
  }

  const closeBar = (
    <div className="flex items-center gap-2">
      <IconButton variant="outlined" aria-label={ui.close} onClick={onClose}>
        <X />
      </IconButton>
    </div>
  )

  // A description that disagrees with the app waits here, one choice at a time; leaving keeps it in the draft.
  const conflict = state.pending ? nextConflict(state.pending) : undefined
  if (state.pending && conflict) {
    const index = state.pending.conflicts.indexOf(conflict)
    const view = conflictView(conflict, state.pending.found)
    return (
      <PageBody className="space-y-4 lg:pb-6">
        {closeBar}
        <ConflictStep
          key={conflict.id}
          index={index}
          total={state.pending.conflicts.length}
          title={view.title}
          app={view.app}
          typed={view.typed}
          onPick={(choice) => pickConflict(conflict.id, choice)}
          onKeep={() => pickConflict(conflict.id, 'app')}
          onBack={index > 0 ? backConflict : undefined}
        />
      </PageBody>
    )
  }

  const showOpener = !buildNow && !state.opener && !state.pending && !focusId && !understood && trail.length === 0 && isOnline()

  if (showOpener) {
    return (
      <PageBody className="space-y-4 lg:pb-6">
        {closeBar}
        <OpenerStep base={base} onDone={finishOpener} onSkip={() => commit({ ...state, opener: 'done' })} />
      </PageBody>
    )
  }

  if (understood && !focusId) {
    const extraRows = (key: ExtraKey): KnownRow[] => {
      if (key === 'utilities') return state.a.utilities === undefined ? [] : [{ id: 'utilities:0', label: ui.opener.utilities, value: money(Number(state.a.utilities)) }]
      return asList(state.a[key]).map((x, i) => {
        const [name, amount] = x.split('|')
        return key === 'holdings'
          ? { id: `holdings:${i}`, label: ui.opener.holdings[name as keyof typeof ui.opener.holdings] ?? name, value: money(Number(amount)), note: ui.opener.holdingNote }
          : { id: `commitments:${i}`, label: name, value: money(Number(amount)) }
      })
    }
    const rows: KnownRow[] = [...new Set(understood.ids)].flatMap((id) => {
      if (EXTRA_KEYS.includes(id)) return extraRows(id as ExtraKey)
      const x = NODE_BY_ID.get(id)
      const v = get(state, id)
      if (v === undefined || (x?.when && !x.when(state))) return []
      return [{ id, label: ui.q[id]?.label ?? id, value: formatKnown(id, v), note: understood.kept.includes(id) ? ui.opener.keptRecords : undefined }]
    })
    const droppedLabels = [...new Set(understood.dropped.map((id) => (id === 'utilities' ? ui.opener.utilities : (ui.q[id]?.label ?? id))))]
    const notes = [
      ...(droppedLabels.length > 0 ? [ui.opener.dropped(droppedLabels.join(', '))] : []),
      ...(understood.unconverted ? [ui.opener.unconverted(understood.unconverted)] : []),
    ]
    const editDraft = editing ? extraDraft(editing) : null
    return (
      <PageBody className="space-y-4 lg:pb-6">
        <UnderstoodStep
          rows={rows}
          notes={notes}
          onEdit={(id) => {
            const [key, index] = id.split(':')
            if (index !== undefined && EXTRA_KEYS.includes(key)) setEditing({ key: key as ExtraKey, index: Number(index) })
            else setFocusId(id)
          }}
          onContinue={() => setUnderstood(null)}
        />
        <CommitmentSheet
          open={editing !== null}
          draft={editDraft}
          title={editDraft?.name}
          base={base}
          onSave={(next) => editing && saveExtra(editing, next)}
          onRemove={() => editing && saveExtra(editing, null)}
          onClose={() => setEditing(null)}
        />
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
        {focusId && understood ? (
          <IconButton variant="outlined" aria-label={ui.back} onClick={() => setFocusId(null)}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
        ) : trail.length > 0 ? (
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
