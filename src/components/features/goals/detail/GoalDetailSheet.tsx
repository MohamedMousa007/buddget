'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Pause, Pencil, Play, Trash2, Trophy, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { CheckpointBar, type CheckpointTone } from '@/components/features/goals/CheckpointBar'
import { CoachCard } from '@/components/features/goals/detail/CoachCard'
import { DeleteGoalSheet } from '@/components/features/goals/detail/DeleteGoalSheet'
import { GoalEditSheet } from '@/components/features/goals/detail/GoalEditSheet'
import { PlanCard, type PlanRow } from '@/components/features/goals/detail/PlanCard'
import { PlanEditorSheet, type PlanEditorKind } from '@/components/features/goals/detail/PlanEditorSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { useGoalAllocationRuns } from '@/hooks/useGoalAllocationRuns'
import type { GoalRow } from '@/hooks/useGoalRows'
import { useLocale, useT } from '@/lib/i18n'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { checkpointInfo, coachView, goalMonthlyRate, replanPatch } from '@/lib/goals/goalDetail'
import { debtMonthlyRate, goalLedger } from '@/lib/goals/debtGoal'
import { goalVisual } from '@/lib/goals/goalVisual'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { navigate } from '@/lib/navigation/navigate'

const CHIP: Record<string, { dot: string }> = {
  green: { dot: 'var(--color-brand-green)' },
  amber: { dot: 'var(--color-brand-amber)' },
  red: { dot: 'var(--color-brand-red)' },
  muted: { dot: 'var(--color-brand-text-muted)' },
}

/** Goal detail: one number, one bar, the plan, and (when behind) Buddgy's two ways back. */
export function GoalDetailSheet({ row, onClose, onAddMoney }: { row: GoalRow; onClose: () => void; onAddMoney: () => void }) {
  const { goal, current, percent, status } = row
  const t = useT()
  const d = t.goals.detail
  const { locale } = useLocale()
  const runs = useGoalAllocationRuns()[goal.id] ?? []
  const s = useFinanceStore(
    useShallow((st) => ({
      incomeEvents: st.incomeEvents, incomeSources: st.incomeSources, expenses: st.expenses,
      budgetCategories: st.budgetCategories, budgetPlans: st.budgetPlans, exchangeRates: st.exchangeRates,
      settings: st.settings, savingsAccounts: st.savingsAccounts, savingsTransactions: st.savingsTransactions,
      updateGoal: st.updateGoal, achieveGoal: st.achieveGoal, debts: st.debts, debtPayments: st.debtPayments,
    })),
  )
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [editor, setEditor] = useState<PlanEditorKind | null>(null)
  const [edit, setEdit] = useState(false)
  const [del, setDel] = useState(false)

  const now = useMemo(() => new Date(), [])
  const today = now.toISOString().slice(0, 10)
  const isLimit = goal.category === 'spending_control'
  const isDebt = goal.category === 'debt_freedom'
  const quarterly = goal.frequency === 'quarterly'
  const basis = useMemo(() => fundingBasis(s, now), [s, now])
  const keep = basis.usualKeep === null ? null : convertCurrency(basis.usualKeep, s.settings.baseCurrency, goal.currency, s.exchangeRates)
  const { icon: Icon, cat } = goalVisual(goal.category)

  const monthlyRate = goal.category === 'debt_freedom' ? debtMonthlyRate(goal, s.debts, s.exchangeRates) : goalMonthlyRate(goal, keep)
  const info = useMemo(() => {
    const ledger = goalLedger(goal, { savingsTransactions: s.savingsTransactions, debts: s.debts, debtPayments: s.debtPayments })
    return checkpointInfo({ goal: ledger.goal, current, txs: ledger.txs, monthlyRate, now, toGoal: (a, c) => convertCurrency(a, c, goal.currency, s.exchangeRates) })
  }, [goal, current, s.savingsTransactions, s.debts, s.debtPayments, s.exchangeRates, monthlyRate, now])
  const coach = useMemo(
    () => coachView({ goal, current, runs, usualKeep: keep, periodSavings: keep === null ? null : keep * (quarterly ? 3 : 1), now }),
    [goal, current, runs, keep, quarterly, now],
  )

  const money = (n: number) => formatCurrency(Math.round(n), goal.currency, false)
  const short = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : '—'
  const month = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(locale, { month: 'short', year: 'numeric' })

  const chipKind =
    goal.status === 'achieved' ? 'chipAchieved'
    : status.kind === 'paused' ? 'chipPaused'
    : status.kind === 'over' ? 'chipOver'
    : status.kind === 'behind' ? 'chipBehind'
    : isDebt ? 'chipDebt'
    : goal.fundingMode === 'manual' ? 'chipManual'
    : runs.length < 2 ? 'chipStarting'
    : 'chipOnTrack'
  const chipTone = { chipAchieved: 'green', chipPaused: 'muted', chipOver: 'red', chipBehind: 'amber', chipManual: 'muted', chipDebt: 'green', chipStarting: 'muted', chipOnTrack: 'green' }[chipKind] as keyof typeof CHIP
  const barTone: CheckpointTone = status.kind === 'over' ? 'over' : status.kind === 'behind' ? 'behind' : status.kind === 'paused' ? 'paused' : 'default'
  const basisAmount = isLimit ? goal.monthlySpendingLimit : goal.targetAmount
  const kindLabel = goal.category === 'debt_freedom' ? d.kindDebt : isLimit ? d.kindLimit : d.kindSave

  const pocket = s.savingsAccounts.find((a) => goal.linkedSavingsAccountIds.includes(a.id))
  const debtRows: PlanRow[] = [
    {
      key: 'debts',
      label: d.planDebts,
      value: s.debts.filter((x) => goal.linkedDebtIds.includes(x.id)).map((x) => x.name).join(', ') || d.noDebtLinked,
    },
    { key: 'finish', label: d.planFinish, value: goal.targetDate ? month(goal.targetDate) : '—', readOnly: true },
  ]
  const rows: PlanRow[] = isLimit ? [] : isDebt ? debtRows : [
    { key: 'finish', label: d.planFinish, value: goal.targetDate ? month(goal.targetDate) : '—' },
    {
      key: 'funding',
      label: quarterly ? d.planEachQuarter : d.planEachMonth,
      value:
        goal.fundingMode === 'manual' ? d.chipManual
        : goal.fundingMode === 'fixed' ? d.eachValue(money(goal.monthlyContribution ?? 0), null)
        : d.eachValue(keep ? money((keep * (goal.sharePct ?? 0)) / 100 * (quarterly ? 3 : 1)) : '—', goal.sharePct),
    },
    { key: 'pocket', label: d.planPocket, value: pocket ? d.pocketValue(pocket.name, formatCurrency(pocket.currentBalance, pocket.currency, false)) : d.noPocket },
  ]

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
    { label: d.menuDelete, icon: <Trash2 className="size-4" />, destructive: true, onSelect: () => setDel(true) },
  ]

  return (
    <>
      <ModalShell
        open
        onBackdropClick={onClose}
        scrollChild
        panelClassName="h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] md:h-[min(46rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(28rem,calc(100vw-2rem))] md:rounded-3xl"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-12 shrink-0 items-center gap-1 ps-5 pe-3">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-brand-text-secondary)]">
              {kindLabel} · {t.goals[goalCategoryLabelKey(goal.category)] as string}
            </span>
            <IconButton aria-label={d.more} onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <MoreHorizontal />
            </IconButton>
            <IconButton aria-label={t.common.close} onClick={onClose}>
              <X />
            </IconButton>
          </div>

          <div className="native-scroll flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-5 pb-4 pt-1 md:px-6 [&>*]:shrink-0">
            <div className="flex items-center gap-3">
              <span
                className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl"
                style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
                aria-hidden
              >
                <Icon className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[22px] font-bold text-[var(--color-brand-text-primary)]">{goal.name}</h2>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-text-primary)]">
                  <span className="size-1.5 rounded-full" style={{ background: CHIP[chipTone].dot }} aria-hidden />
                  {d[chipKind as 'chipOnTrack']}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3 font-mono-numbers">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="whitespace-nowrap text-[40px] font-semibold leading-none tracking-[-0.03em] text-[var(--color-brand-text-primary)]">{money(current)}</span>
                  {basisAmount ? <span className="whitespace-nowrap text-sm text-[var(--color-brand-text-secondary)]">{t.goals.home.ofTarget(money(basisAmount))}</span> : null}
                </p>
                <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{percent}%</span>
              </div>
              <CheckpointBar percent={percent} tone={barTone} nodes={!isLimit} />
              {!isLimit ? (
                <>
                  <div className="grid grid-cols-4">
                    {info.nodes.map((n) => (
                      <div key={n.pct} className="text-center">
                        <p className={`font-mono-numbers text-xs font-semibold ${n.reached ? 'text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-secondary)]'}`}>{n.pct}%</p>
                        <p className="font-mono-numbers text-[11px] text-[var(--color-brand-text-secondary)]">{short(n.date)}</p>
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
                currency={goal.currency}
                targetDate={goal.targetDate}
                quarterly={quarterly}
                onMove={() => doReplan('move')}
                onKeep={() => doReplan('keep')}
              />
            ) : null}

            {rows.length ? <PlanCard rows={rows} onOpen={setEditor} /> : null}
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
      {editor ? <PlanEditorSheet goal={goal} kind={editor} current={current} onClose={() => setEditor(null)} /> : null}
      {edit ? <GoalEditSheet goal={goal} onClose={() => setEdit(false)} /> : null}
      {del ? <DeleteGoalSheet goal={goal} onClose={() => setDel(false)} onDeleted={() => { setDel(false); onClose() }} /> : null}
    </>
  )
}
