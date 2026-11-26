'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { useMemo, useState } from 'react'
import { Check, MoreVertical, Pause, Pencil, Play, Repeat, Trash2, Trophy } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { CheckpointBar, type CheckpointTone } from '@/components/features/goals/CheckpointBar'
import { FundItSheet, useFundSummary, type FundPlan } from '@/components/features/goals/FundItSheet'
import { CoachCard } from '@/components/features/goals/detail/CoachCard'
import { DeleteGoalSheet } from '@/components/features/goals/detail/DeleteGoalSheet'
import { GoalEditSheet } from '@/components/features/goals/detail/GoalEditSheet'
import { PlanCard, type PlanRow } from '@/components/features/goals/detail/PlanCard'
import { PlanEditorSheet } from '@/components/features/goals/detail/PlanEditorSheet'
import { PocketPickerField } from '@/components/features/savings-v3/MoneySheetParts'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { useGoalAllocationRuns } from '@/hooks/useGoalAllocationRuns'
import type { GoalRow } from '@/hooks/useGoalRows'
import { useLocale, useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { checkpointInfo, coachView, finishesLate, goalMonthlyRate, replanPatch } from '@/lib/goals/goalDetail'
import { defaultSharePct, periodMonths, sharesOverFull } from '@/lib/goals/goalPlan'
import { debtMonthlyRate, goalLedger } from '@/lib/goals/debtGoal'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { relinkGoalPocket } from '@/lib/goals/goalPocket'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { navigate } from '@/lib/navigation/navigate'
import { cn } from '@/lib/utils'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Badge } from '@/components/ui/badge'

const CHIP = { green: 'brand', amber: 'warn', red: 'negative', muted: 'neutral' } as const

const planOf = (g: GoalRow['goal'], otherShare: number): FundPlan => ({
  mode: g.fundingMode,
  sharePct: g.sharePct ?? defaultSharePct(otherShare),
  fixed: g.monthlyContribution ? String(g.monthlyContribution) : '',
  frequency: g.frequency,
})

/** Goal detail: one number, one bar with its milestones, the plan, and (when behind) Buddgy's two ways back. */
export function GoalDetailSheet({ row, onClose, onAddMoney }: { row: GoalRow; onClose: () => void; onAddMoney: () => void }) {
  const { goal, current, percent, status } = row
  const t = useT()
  const d = t.goals.detail
  const lt = useGoalsLtCopy()
  const fundSummary = useFundSummary()
  const { locale } = useLocale()
  const runs = useGoalAllocationRuns()[goal.id] ?? []
  const s = useFinanceStore(
    useShallow((st) => ({
      incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses,
      budgetCategories: st.budgetCategories, budgetPlans: st.budgetPlans, activeBudgetPlanId: st.activeBudgetPlanId, exchangeRates: st.exchangeRates,
      settings: st.settings, savingsAccounts: st.savingsAccounts, savingsTransactions: st.savingsTransactions, goals: st.goals,
      updateGoal: st.updateGoal, achieveGoal: st.achieveGoal, debts: st.debts, debtPayments: st.debtPayments,
    })),
  )
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [debtEditor, setDebtEditor] = useState(false)
  const [fund, setFund] = useState<FundPlan | null>(null)
  const [edit, setEdit] = useState(false)
  const [del, setDel] = useState(false)

  const now = useMemo(() => new Date(), [])
  const today = localTodayISO(now)
  const isLimit = goal.category === 'spending_control'
  const isDebt = goal.category === 'debt_freedom'
  const quarterly = goal.frequency === 'quarterly'
  const basis = useMemo(() => fundingBasis(s, now), [s, now])
  const keep = basis.usualKeep === null ? null : convertCurrency(basis.usualKeep, s.settings.baseCurrency, goal.currency, s.exchangeRates)

  const monthlyRate = goal.category === 'debt_freedom' ? debtMonthlyRate(goal, s.debts, s.exchangeRates) : goalMonthlyRate(goal, keep)
  const info = useMemo(() => {
    const ledger = goalLedger(goal, { savingsTransactions: s.savingsTransactions, debts: s.debts, debtPayments: s.debtPayments })
    return checkpointInfo({ goal: ledger.goal, current, txs: ledger.txs, monthlyRate, now, toGoal: (a, c) => convertCurrency(a, c, goal.currency, s.exchangeRates) })
  }, [goal, current, s.savingsTransactions, s.debts, s.debtPayments, s.exchangeRates, monthlyRate, now])
  const coach = useMemo(
    () => coachView({ goal, current, runs, usualKeep: keep, periodSavings: keep === null ? null : keep * periodMonths(goal.frequency), now }),
    [goal, current, runs, keep, now],
  )
  const pockets: PocketVM[] = useMemo(
    () => s.savingsAccounts.filter(isEligibleCarryPocket).map((account) => ({ account, coverAmount: 0, goalsAmount: 0, goalLabel: '', isAuto: false })),
    [s.savingsAccounts],
  )

  const money = (n: number) => formatWhole(Math.round(n))
  const short = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: '2-digit' }) : '—'
  const month = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' })

  const late = !isLimit && !isDebt && status.kind !== 'paused' && finishesLate(goal, current, monthlyRate, now)
  const chipKind =
    goal.status === 'achieved' ? 'chipAchieved'
    : status.kind === 'paused' ? 'chipPaused'
    : status.kind === 'over' ? 'chipOver'
    : status.kind === 'behind' || late ? 'chipBehind'
    : isDebt ? 'chipDebt'
    : goal.fundingMode === 'manual' ? 'chipManual'
    : runs.length < 2 ? 'chipStarting'
    : 'chipOnTrack'
  const chipTone = { chipAchieved: 'green', chipPaused: 'muted', chipOver: 'red', chipBehind: 'amber', chipManual: 'muted', chipDebt: 'green', chipStarting: 'muted', chipOnTrack: 'green' }[chipKind] as keyof typeof CHIP
  const barTone: CheckpointTone = status.kind === 'over' ? 'over' : status.kind === 'behind' || late ? 'behind' : status.kind === 'paused' ? 'paused' : 'default'
  const basisAmount = isLimit ? goal.monthlySpendingLimit : goal.targetAmount
  const kindLabel = goal.category === 'debt_freedom' ? d.kindDebt : isLimit ? d.kindLimit : d.kindSave

  const pocket = s.savingsAccounts.find((a) => a.id === goal.linkedSavingsAccountIds[0])
  const debtRows: PlanRow[] = [
    {
      key: 'debts',
      label: d.planDebts,
      value: s.debts.filter((x) => goal.linkedDebtIds.includes(x.id)).map((x) => x.name).join(', ') || d.noDebtLinked,
    },
    { key: 'finish', label: d.planFinish, value: goal.targetDate ? month(goal.targetDate) : '—', readOnly: true },
  ]
  const otherShare = s.goals.filter((g) => g.id !== goal.id && g.status === 'active' && g.fundingMode === 'share').reduce((a, g) => a + (g.sharePct ?? 0), 0)
  const plan = planOf(goal, otherShare)

  const saveFund = () => {
    if (fund?.mode === 'share' && sharesOverFull(otherShare, fund.sharePct)) return
    if (fund) {
      const fixed = Number(fund.fixed)
      s.updateGoal(goal.id, {
        fundingMode: fund.mode,
        sharePct: fund.mode === 'share' ? fund.sharePct : null,
        monthlyContribution: fund.mode === 'fixed' && fixed > 0 ? fixed : null,
        frequency: fund.mode === 'fixed' ? fund.frequency : 'monthly',
        planStart: today,
      })
    }
    setFund(null)
  }

  const doReplan = (choice: 'move' | 'keep') => {
    if (!coach) return
    const patch = replanPatch(goal, choice, coach.options, today)
    if (patch) s.updateGoal(goal.id, patch)
  }

  const menuItems = [
    { label: d.menuEdit, icon: <Pencil className="size-4" />, onSelect: () => setEdit(true) },
    goal.status === 'paused'
      ? { label: d.menuResume, icon: <Play className="size-4" />, onSelect: () => s.updateGoal(goal.id, { status: 'active' }) }
      : { label: d.menuPause, icon: <Pause className="size-4" />, onSelect: () => s.updateGoal(goal.id, { status: 'paused' }) },
    ...(goal.status === 'achieved' ? [] : [{ label: d.menuAchieve, icon: <Trophy className="size-4" />, onSelect: () => { s.achieveGoal(goal.id); onClose() } }]),
  ]
  const reachedCount = info.nodes.filter((n) => n.reached).length

  return (
    <>
      <ModalShell
        open
        onBackdropClick={onClose}
        scrollChild
        panelClassName="h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] md:h-[min(46rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(28rem,calc(100vw-2rem))] md:rounded-3xl"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader
            onClose={onClose}
            actions={
              <>
                <IconButton variant="sheetAction" aria-label={d.more} aria-haspopup="menu" aria-expanded={menu !== null} onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
                  <MoreVertical className="size-4" />
                </IconButton>
                <V3SheetHeader.Action icon={<Trash2 className="size-4" />} label={lt.goals.deleteGoal} tone="danger" onClick={() => setDel(true)} />
              </>
            }
          >
            <V3SheetHeader.Title size="compact">{goal.name}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>{kindLabel} · {t.goals[goalCategoryLabelKey(goal.category)] as string}</span>
                <Badge tone={CHIP[chipTone]} size="sm" bordered={false} className="uppercase tracking-[0.05em]">
                  {d[chipKind as 'chipOnTrack']}
                </Badge>
              </span>
            </V3SheetHeader.Subtitle>
          </V3SheetHeader>

          <div className="native-scroll flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-5 pb-4 pt-2 md:px-6 [&>*]:shrink-0">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3 font-mono-numbers">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="whitespace-nowrap text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">{money(current)}</span>
                  {basisAmount ? <span className="whitespace-nowrap text-sm text-[var(--color-brand-text-muted)]">{t.goals.home.ofTarget(money(basisAmount))}</span> : null}
                </p>
                <span className="text-base font-semibold text-[var(--color-brand-text-primary)]">{percent}%</span>
              </div>
              <CheckpointBar percent={percent} tone={barTone} nodes={!isLimit} look="marks" size="lg" />
              {!isLimit ? (
                <>
                  <div className="grid grid-cols-4 gap-2 text-center" role="list" aria-label={lt.goals.milestonesAria(reachedCount)}>
                    {info.nodes.map((n) => (
                      <div
                        key={n.pct}
                        role="listitem"
                        className={cn('rounded-xl py-2', n.reached ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]' : 'bg-[var(--color-brand-elevated)]')}
                      >
                        <p className={cn('flex items-center justify-center gap-1 font-mono-numbers text-sm font-semibold', !n.reached && 'text-[var(--color-brand-text-primary)]')}>
                          {n.reached ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                          {n.pct}%
                        </p>
                        <p className={cn('font-mono-numbers text-[0.6875rem]', n.reached ? 'font-semibold' : 'text-[var(--color-brand-text-muted)]')}>
                          {n.reached ? lt.goals.reached : short(n.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-[var(--color-brand-text-secondary)]">
                    {info.next ? d.nextCheckpoint(info.next.pct, info.monthsToNext) : d.allDone}
                  </p>
                </>
              ) : null}
            </div>

            {coach && goal.targetDate ? (
              <CoachCard
                coach={coach}
                targetDate={goal.targetDate}
                quarterly={quarterly}
                yearly={goal.frequency === 'yearly'}
                onMove={() => doReplan('move')}
                onKeep={() => doReplan('keep')}
              />
            ) : null}

            {isDebt ? (
              <PlanCard rows={debtRows} onOpen={() => setDebtEditor(true)} />
            ) : !isLimit ? (
              <div>
                <Card padding="none" divide className="overflow-hidden">
                  <PickerRow
                    label={lt.goals.finishLine}
                    value={
                      <DatePickerField
                        look="pill"
                        mode="month"
                        value={goal.targetDate?.slice(0, 7) ?? ''}
                        onChange={(v) => s.updateGoal(goal.id, { targetDate: `${v.slice(0, 7)}-01`, planStart: today })}
                      />
                    }
                  />
                  <PickerRow
                    label={lt.frequency.eachLabel[goal.fundingMode === 'fixed' ? goal.frequency : 'monthly']}
                    onClick={() => setFund(plan)}
                    chevron={false}
                    value={<Pill icon={<Repeat />}>{fundSummary(plan, (n) => formatWhole(n))}</Pill>}
                  />
                  <PocketPickerField
                    look="row"
                    label={lt.goals.pocket}
                    pockets={pockets}
                    value={pocket?.id ?? null}
                    onChange={(id) => s.updateGoal(goal.id, { linkedSavingsAccountIds: relinkGoalPocket(goal.linkedSavingsAccountIds, s.savingsAccounts, id) })}
                  />
                </Card>
                <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{lt.goals.pocketNote}</p>
              </div>
            ) : null}
          </div>

          <div className="sheet-cta flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pb-6 pt-3 md:px-6">
            {isLimit ? (
              <Button size="cta-block" variant="outline" onClick={() => setEdit(true)}>{t.goals.home.actionAdjust}</Button>
            ) : (
              <Button size="cta-block" onClick={goal.category === 'debt_freedom' ? () => navigate('/debts') : onAddMoney}>
                {isDebt ? t.goals.home.actionPay : t.goals.home.actionAddMoney}
              </Button>
            )}
          </div>
        </div>
      </ModalShell>
      <CardActionMenu anchor={menu} items={menuItems} onClose={() => setMenu(null)} zClassName="z-[120]" />
      {fund ? (
        <FundItSheet
          open
          onClose={() => setFund(null)}
          onDone={saveFund}
          name={goal.name}
          currency={goal.currency}
          value={fund}
          onChange={setFund}
          usualKeep={keep}
          otherShare={otherShare}
        />
      ) : null}
      {debtEditor ? <PlanEditorSheet goal={goal} onClose={() => setDebtEditor(false)} /> : null}
      {edit ? <GoalEditSheet goal={goal} onClose={() => setEdit(false)} /> : null}
      {del ? <DeleteGoalSheet goal={goal} onClose={() => setDel(false)} onDeleted={() => { setDel(false); onClose() }} /> : null}
    </>
  )
}
