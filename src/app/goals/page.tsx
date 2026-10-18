'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { AchievedView } from '@/components/features/goals/AchievedView'
import { GoalAddMoneySheet } from '@/components/features/goals/GoalAddMoneySheet'
import { GoalCard, type GoalCardAction } from '@/components/features/goals/GoalCard'
import { NewGoalFlow } from '@/components/features/goals/new/NewGoalFlow'
import type { FlowSeed } from '@/hooks/useNewGoalForm'
import { GoalsEmpty } from '@/components/features/goals/GoalsEmpty'
import { TrophyChip } from '@/components/features/goals/TrophyChip'
import { PageGrid } from '@/components/layout/PageGrid'
import { AddGoalSheet } from '@/components/modals/AddGoalSheet'
import { Button } from '@/components/ui/button'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useGoalRows, type GoalRow } from '@/hooks/useGoalRows'
import { useHydrateDebts, useHydrateGoals, useHydrateSavings } from '@/hooks/remote'
import { useT } from '@/lib/i18n'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'

type View = 'all' | 'active' | 'paused' | 'achieved'
const VIEW_KEY = 'goals-view'

function readView(): View {
  try {
    const v = sessionStorage.getItem(VIEW_KEY)
    return v === 'all' || v === 'paused' || v === 'achieved' ? v : 'active'
  } catch {
    return 'active'
  }
}

export default function GoalsPage() {
  useHydrateGoals()
  useHydrateSavings()
  useHydrateDebts()
  const t = useT().goals
  const { dataReady, baseCurrency, rates, updateGoal } = useFinanceStore(
    useShallow((s) => ({ dataReady: s.dataReady, baseCurrency: s.settings.baseCurrency, rates: s.exchangeRates, updateGoal: s.updateGoal })),
  )
  const rows = useGoalRows()
  const [view, setViewState] = useState<View>(readView)
  const [flow, setFlow] = useState<FlowSeed | null | false>(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [moneyGoal, setMoneyGoal] = useState<Goal | null>(null)
  const [bannerOff, setBannerOff] = useState<string | null>(null)

  const setView = (v: View) => {
    setViewState(v)
    try {
      sessionStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private window: the view just resets next visit */
    }
  }

  const { running, paused, achieved } = useMemo(
    () => ({
      running: rows.filter((r) => r.goal.status === 'active'),
      paused: rows.filter((r) => r.goal.status === 'paused'),
      achieved: rows
        .filter((r) => r.goal.status === 'achieved')
        .map((r) => r.goal)
        .sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? '')),
    }),
    [rows],
  )

  const worstBehind = useMemo(
    () =>
      running
        .filter((r) => r.status.kind === 'behind' && (r.status.params.count ?? 0) >= 2)
        .sort((a, b) => (b.status.params.count ?? 0) - (a.status.params.count ?? 0))[0],
    [running],
  )

  const openAdd = (seed: FlowSeed = {}) => setFlow(seed)
  const openEdit = (g: Goal) => {
    setEditing(g)
    setSheetOpen(true)
  }
  const onAction = (g: Goal, a: GoalCardAction) => {
    if (a === 'resume') return updateGoal(g.id, { status: 'active' })
    if (a === 'addMoney') return g.category === 'debt_freedom' ? navigate('/debts') : setMoneyGoal(g)
    openEdit(g)
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const visible: GoalRow[] = view === 'paused' ? paused : view === 'all' ? [...running, ...paused] : running
  const titleByView = { all: t.home.titleAll, active: t.home.titleActive, paused: t.home.titlePaused, achieved: t.home.titleAchieved }
  const count = view === 'achieved' ? achieved.length : visible.length
  const empty = rows.length === 0

  return (
    <div>
      <PageGrid
        primary={
          <div className="flex min-w-0 flex-col gap-3.5 px-4 pb-4 pt-4 lg:px-0 lg:pb-0 lg:pt-0">
            {empty ? (
              <GoalsEmpty onStart={openAdd} />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <SegmentedControl<'all' | 'active' | 'paused'>
                    ariaLabel={t.home.viewLabel}
                    value={view === 'achieved' ? ('' as 'all') : view}
                    onChange={setView}
                    options={[
                      { value: 'all', label: t.home.viewAll },
                      { value: 'active', label: t.home.viewActive },
                      { value: 'paused', label: t.home.viewPaused },
                    ]}
                    className="flex-1"
                  />
                  <TrophyChip count={achieved.length} pressed={view === 'achieved'} onClick={() => setView(view === 'achieved' ? 'active' : 'achieved')} />
                </div>

                {view !== 'achieved' && worstBehind && bannerOff !== worstBehind.goal.id ? (
                  <PromptBanner
                    tone="warning"
                    icon={<AlertTriangle />}
                    title={t.home.bannerBehind(worstBehind.goal.name, worstBehind.status.params.count ?? 2, worstBehind.goal.frequency === 'quarterly')}
                    confirmLabel={t.home.bannerReplan(worstBehind.goal.name)}
                    onConfirm={() => openEdit(worstBehind.goal)}
                    dismissLabel={t.home.dismiss}
                    onDismiss={() => setBannerOff(worstBehind.goal.id)}
                  />
                ) : null}

                <div className="flex min-h-11 items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--color-brand-text-primary)]">
                    {titleByView[view]}
                    <span className="min-w-6 rounded-full bg-[var(--color-brand-elevated)] px-2 py-0.5 text-center font-mono-numbers text-xs font-semibold text-[var(--color-brand-text-secondary)]">
                      {count}
                    </span>
                  </h2>
                  <Button size="touch" onClick={() => openAdd()}>
                    <Plus aria-hidden />
                    {t.home.newGoal}
                  </Button>
                </div>

                {view === 'paused' ? (
                  <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{t.home.pausedHelper}</p>
                ) : null}

                {view === 'achieved' ? (
                  <AchievedView goals={achieved} base={baseCurrency} rates={rates} onNewGoal={() => openAdd()} />
                ) : visible.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-brand-text-secondary)]">{t.home.emptyFilter}</p>
                ) : (
                  <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2">
                    {visible.map((r, i) => (
                      <div key={r.goal.id} className="contents">
                        {view === 'all' && paused.length > 0 && i === running.length ? (
                          <h3 className={`${microClassName} lg:col-span-2`}>{t.home.viewPaused}</h3>
                        ) : null}
                        <GoalCard row={r} onOpen={openEdit} onAction={onAction} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        }
      />
      <AddGoalSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null) }} editingGoal={editing} />
      <NewGoalFlow open={flow !== false} seed={flow || null} onClose={() => setFlow(false)} />
      <GoalAddMoneySheet goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
    </div>
  )
}
