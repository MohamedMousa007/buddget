'use client'

import { partitionGoals } from '@/lib/goals/partitionGoals'
import { useMemo, useState } from 'react'
import { AlertTriangle, Flag, PauseCircle, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { AchievedView } from '@/components/features/goals/AchievedView'
import { GoalAddMoneySheet } from '@/components/features/goals/GoalAddMoneySheet'
import { GoalCard, type GoalCardAction } from '@/components/features/goals/GoalCard'
import { NewGoalFlow } from '@/components/features/goals/new/NewGoalFlow'
import type { FlowSeed } from '@/hooks/useNewGoalForm'
import { GoalsInsight } from '@/components/features/goals/GoalsInsight'
import { GoalsEmpty } from '@/components/features/goals/GoalsEmpty'
import { TrophyChip } from '@/components/features/goals/TrophyChip'
import { PageGrid } from '@/components/layout/PageGrid'
import { GoalDetailSheet } from '@/components/features/goals/detail/GoalDetailSheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatTile } from '@/components/ui/StatTile'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useGoalRows, type GoalRow } from '@/hooks/useGoalRows'
import { useT } from '@/lib/i18n'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Goal } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { GoalsHero } from '@/components/features/goals/GoalsHero'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { useGoalsEmptyCopy } from '@/lib/i18n/goalsEmptyCopy'

type View = 'all' | 'active' | 'paused' | 'achieved'
const VIEW_KEY = 'goals-view'

function readView(): View {
  try {
    const v = sessionStorage.getItem(VIEW_KEY)
    return v === 'active' || v === 'paused' || v === 'achieved' ? v : 'all'
  } catch {
    return 'all'
  }
}

export default function GoalsPage() {
  const t = useT().goals
  const lt = useGoalsLtCopy()
  const emptyCopy = useGoalsEmptyCopy()
  const { dataReady, baseCurrency, rates, updateGoal } = useFinanceStore(
    useShallow((s) => ({ dataReady: s.dataReady, baseCurrency: s.settings.baseCurrency, rates: s.exchangeRates, updateGoal: s.updateGoal })),
  )
  const rows = useGoalRows()
  const [view, setViewState] = useState<View>(readView)
  const [flow, setFlow] = useState<FlowSeed | null | false>(false)
  const [detailId, setDetailId] = useState<string | null>(null)
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

  const { running, paused, achieved } = useMemo(() => {
    const parts = partitionGoals(rows)
    return { ...parts, achieved: parts.achieved.map((r) => r.goal).sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? '')) }
  }, [rows])

  const detailRow = rows.find((r) => r.goal.id === detailId) ?? null

  const worstBehind = useMemo(
    () =>
      running
        .filter((r) => r.status.kind === 'behind' && (r.status.params.count ?? 0) >= 2)
        .sort((a, b) => (b.status.params.count ?? 0) - (a.status.params.count ?? 0))[0],
    [running],
  )

  // The trophy room's nudge: the running saving goal closest to its target.
  const nextToFinish = useMemo(
    () =>
      running
        .filter((r) => r.goal.status === 'active' && r.goal.category !== 'spending_control' && r.goal.category !== 'debt_freedom' && r.percent < 100)
        .sort((a, b) => b.percent - a.percent)[0] ?? null,
    [running],
  )

  const openAdd = (seed: FlowSeed = {}) => setFlow(seed)
  const openDetail = (g: Goal) => setDetailId(g.id)
  const onAction = (g: Goal, a: GoalCardAction) => {
    if (a === 'resume') return updateGoal(g.id, { status: 'active' })
    if (a === 'addMoney') return g.category === 'debt_freedom' ? navigate('/debts') : setMoneyGoal(g)
    openDetail(g)
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const visible: GoalRow[] = view === 'paused' ? paused : view === 'all' ? [...running, ...paused] : running
  const titleByView = { all: t.home.titleAll, active: t.home.titleActive, paused: t.home.titlePaused, achieved: t.home.titleAchieved }
  const count = view === 'achieved' ? achieved.length : visible.length
  const empty = rows.length === 0

  return (
    <div>
      <PageGrid
        stack
        wide={empty}
        primary={
          <div className="flex min-w-0 flex-col gap-3.5 px-4 pb-4 pt-4 lg:px-0 lg:pb-0 lg:pt-0">
            {empty ? (
              <GoalsEmpty onStart={openAdd} />
            ) : (
              <>
                {view === 'achieved' ? null : <GoalsHero rows={rows} />}
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
                  <TrophyChip count={achieved.length} pressed={view === 'achieved'} onClick={() => setView(view === 'achieved' ? 'all' : 'achieved')} />
                </div>

                {view !== 'achieved' && worstBehind && bannerOff !== worstBehind.goal.id ? (
                  <PromptBanner
                    tone="warning"
                    icon={<AlertTriangle />}
                    title={worstBehind.goal.frequency === 'yearly'
                      ? lt.frequency.bannerBehind(worstBehind.goal.name, worstBehind.status.params.count ?? 2)
                      : t.home.bannerBehind(worstBehind.goal.name, worstBehind.status.params.count ?? 2, worstBehind.goal.frequency === 'quarterly')}
                    confirmLabel={t.home.bannerReplan(worstBehind.goal.name)}
                    onConfirm={() => openDetail(worstBehind.goal)}
                    dismissLabel={t.home.dismiss}
                    onDismiss={() => setBannerOff(worstBehind.goal.id)}
                  />
                ) : null}

                {view === 'achieved' ? null : (
                  <div className="mt-2.5 flex min-h-11 items-center gap-2 px-1">
                    <h2 className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{titleByView[view]}</h2>
                    <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{count}</span>
                    <Button variant="link" size="touch" onClick={() => openAdd()} className="ms-auto gap-1 px-1 font-semibold no-underline">
                      <Plus className="size-4" aria-hidden />
                      {t.home.newGoal}
                    </Button>
                  </div>
                )}

                {view === 'paused' ? (
                  <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{t.home.pausedHelper}</p>
                ) : null}

                {view === 'achieved' ? (
                  <AchievedView goals={achieved} base={baseCurrency} rates={rates} next={nextToFinish} onOpen={openDetail} onNewGoal={() => openAdd()} />
                ) : visible.length === 0 ? (
                  <EmptyState
                    variant="card"
                    icon={view === 'paused' ? <PauseCircle /> : <Flag />}
                    iconTone={view === 'paused' ? 'neutral' : 'brand'}
                    title={view === 'paused' ? emptyCopy.pausedTitle : emptyCopy.activeTitle}
                    description={view === 'paused' ? emptyCopy.pausedBody : emptyCopy.activeBody}
                    action={
                      <div className="flex w-full flex-col gap-1">
                        <Button size="cta-block" onClick={() => openAdd()}>{emptyCopy.newGoal}</Button>
                        {view === 'active' && paused.length > 0 ? (
                          <Button variant="link" size="touch" className="font-semibold" onClick={() => setView('paused')}>{emptyCopy.seePaused}</Button>
                        ) : null}
                        {view !== 'paused' && achieved.length > 0 ? (
                          <Button variant="link" size="touch" className="whitespace-normal font-semibold" onClick={() => setView('achieved')}>{lt.goals.seeAchieved(achieved.length)}</Button>
                        ) : null}
                      </div>
                    }
                  />
                ) : (
                  <div className="-mt-1.5 flex flex-col gap-2">
                    {visible.map((r, i) => (
                      <div key={r.goal.id} className="contents">
                        {view === 'all' && paused.length > 0 && i === running.length ? (
                          <h3 className={microClassName}>{t.home.viewPaused}</h3>
                        ) : null}
                        <GoalCard look="light" row={r} onOpen={openDetail} onAction={onAction} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        }
        secondary={
          empty ? undefined : (
            <div className="hidden flex-col gap-4 lg:flex">
              <div className="grid grid-cols-3 gap-2">
                <StatTile compact label={t.home.viewActive} value={running.length} onClick={() => setView('active')} />
                <StatTile compact label={t.home.viewPaused} value={paused.length} onClick={() => setView('paused')} />
                <StatTile compact label={t.achieved} value={achieved.length} tone="positive" onClick={() => setView('achieved')} />
              </div>
              <GoalsInsight rows={rows} />
            </div>
          )
        }
      />
      {detailRow ? (
        <GoalDetailSheet row={detailRow} onClose={() => setDetailId(null)} onAddMoney={() => setMoneyGoal(detailRow.goal)} />
      ) : null}
      <NewGoalFlow open={flow !== false} seed={flow || null} onClose={() => setFlow(false)} />
      <GoalAddMoneySheet goal={moneyGoal} onClose={() => setMoneyGoal(null)} overSheet={!!detailRow} />
    </div>
  )
}
