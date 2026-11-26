'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { HEADER_PILL } from '@/components/ui/PillButton'
import { useActionToast } from '@/components/ui/ActionToast'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import { PocketPickerField, SheetBody, SheetFooter, type PocketPickerGoal } from '@/components/features/savings-v3/MoneySheetParts'
import { MoneySourceField, type MoneySource } from '@/components/features/savings-v3/MoneySourceField'
import { useLegAccount } from '@/components/features/savings-v3/useLegAccount'
import { useDepositGuard } from '@/components/features/savings-v3/useDepositGuard'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { GoalGlyph } from '@/components/features/goals/GoalGlyph'
import { useGoalRows } from '@/hooks/useGoalRows'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { goalAddHint } from '@/lib/goals/goalAddHint'
import { depositIntoGoal } from '@/lib/goals/goalPocket'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import { applyPocketDeposit } from '@/lib/savings/moneySourceDeposit'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, Goal } from '@/lib/store/types'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { formatWhole } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'

const isSaveGoal = (g: Goal) => g.category !== 'debt_freedom' && g.category !== 'spending_control'

/**
 * Money into a goal: the goal's icon over the amount, the goal (goals-only picker) and where the money comes from.
 * The goal's pocket is created (and linked) when it has none yet.
 */
export function GoalAddMoneySheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  if (!goal) return null
  return <GoalMoney key={goal.id} goal={goal} onClose={onClose} />
}

function GoalMoney({ goal: initial, onClose }: { goal: Goal; onClose: () => void }) {
  const t = useT()
  const tMoney = t.wealthSheets.money
  const sf = t.savingsForms
  const lt = useGoalsLtCopy()
  const c = lt.money
  const hidden = useMask('lists')
  const showToast = useActionToast()
  const rows = useGoalRows()
  const { savingsAccounts, baseCurrency } = useFinanceStore(useShallow((s) => ({ savingsAccounts: s.savingsAccounts, baseCurrency: s.settings.baseCurrency })))

  const [goalId, setGoalId] = useState(initial.id)
  const row = rows.find((r) => r.goal.id === goalId)
  const goal = row?.goal ?? initial
  // New money goes to the goal's current pocket: the first linked one (an older pocket can stay linked for what it holds).
  const pocket = goal.linkedSavingsAccountIds.map((id) => savingsAccounts.find((a) => a.id === id)).find((a) => !!a && isEligibleCarryPocket(a))
  const [amount, setAmount] = useState('')
  // The amount can be typed in another currency; it lands in the goal's pocket converted, as on Add money.
  const [currency, setCurrency] = useState<string>(String(initial.currency))
  const [date, setDate] = useState(() => localTodayISO())
  const [clock, setClock] = useState('')
  const timeLabel = useFlowLtCopy().expense.time
  const [source, setSource] = useState<MoneySource>({ kind: 'account' })
  const value = Number(amount) || 0
  const discard = useDiscardPrompt(amount.trim() !== '', onClose)

  const leg = useLegAccount(pocket, String(goal.currency), true)
  // A goal with no pocket yet gets one outside the accounts.
  const guard = useDepositGuard(pocket ?? { currency: goal.currency, currentBalance: 0 })
  const effective: MoneySource = source.kind === 'account' ? { kind: 'account', id: source.id ?? leg.accountId ?? undefined } : source

  const pockets: PocketVM[] = useMemo(
    () => savingsAccounts.filter(isEligibleCarryPocket).map((account) => ({ account, coverAmount: 0, goalsAmount: 0, goalLabel: '', isAuto: false })),
    [savingsAccounts],
  )
  const fromPocket = effective.kind === 'pocket' ? savingsAccounts.find((a) => a.id === effective.id) : undefined
  const goals: PocketPickerGoal[] = rows
    .filter((r) => isSaveGoal(r.goal) && r.goal.status !== 'achieved')
    .map((r) => ({ id: r.goal.id, name: r.goal.name, glyph: <GoalGlyph goal={r.goal} />, saved: r.current, target: r.goal.targetAmount }))

  const refusal = effective.kind === 'pocket'
    ? null
    : guard.refusalFor({ amount: value, currency, mode: effective.kind === 'outside' ? 'declare' : 'allocate', fromAccountId: effective.id ?? null })
  const pocketShort = !!fromPocket && fromPocket.currency === currency && value > fromPocket.currentBalance
  const canSubmit = value > 0 && !refusal && !pocketShort && (effective.kind !== 'pocket' || !!fromPocket)

  const sourceLine = (() => {
    if (effective.kind === 'outside') return c.srcOutside
    if (effective.kind === 'pocket') return fromPocket ? c.srcPocket(pocketDisplayName(fromPocket, sf.systemNames)) : ''
    const method = leg.views.find((v) => v.method.id === effective.id)?.method
    if (!method) return ''
    return guard.holder && method.id === guard.holder.id ? c.srcHeld : c.srcAccount(accountTitle(method))
  })()
  const saved = row?.current ?? 0
  const target = goal.targetAmount ?? 0
  // Before an amount is typed the line still says how far the goal is from its target.
  const hint = !isSaveGoal(goal) || currency !== String(goal.currency) ? null : value > 0 ? goalAddHint(saved, target, value) : target > saved ? { kind: 'left' as const, amount: target - saved } : null
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const hintText = !hint ? '' : hint.kind === 'exact' ? t.goals.home.addExact : hint.kind === 'left' ? lt.goals.leftToReach(money(hint.amount), money(target)) : t.goals.home.addOver(money(hint.amount))

  const save = () => {
    if (!canSubmit) return
    const ok = depositIntoGoal(useFinanceStore.getState(), goal, pocket?.id, t.catalogs.goalPocketName(goal.name), (pocketId) =>
      applyPocketDeposit(useFinanceStore.getState(), {
        pocketId, amount: value, currency: currency as Currency, source: effective, note: goal.name,
        date: date !== localTodayISO() ? date : undefined,
        occurredAt: manualOccurredAt(date, clock),
      }),
    )
    if (!ok) return showToast(tMoney.moveFailed)
    onClose()
  }

  return (
    <ModalShell open onBackdropClick={onClose} scrollChild>
      {discard.prompt}
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={discard.close} leading={<DatePickerField look="pill" className={HEADER_PILL} value={date} onChange={setDate} time={{ value: clock, onChange: setClock, label: timeLabel, defaultNow: true }} />}>
          <span className="sr-only"><V3SheetHeader.Title>{t.goals.home.addMoneyTitle(goal.name)}</V3SheetHeader.Title></span>
        </V3SheetHeader>

        <SheetBody className="space-y-3 pt-0">
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={currency}
            onCurrencyChange={setCurrency}
            base={baseCurrency}
            sign="+"
            aria-label={t.goals.home.addMoneyAmount}
            top={<GoalGlyph goal={goal} size={52} />}
            line={
              <>
                <span dir="auto" className="block text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{goal.name}</span>
                <span className="mt-1 block" role="status">
                  {hintText}
                  {hintText && sourceLine ? ' · ' : null}
                  {sourceLine}
                </span>
              </>
            }
            className="px-0"
          />

          <MoneySourceField
            value={effective}
            onChange={setSource}
            paymentMethods={leg.views.map((v) => v.method)}
            pockets={pockets}
            excludePocketIds={pocket ? [pocket.id] : undefined}
          >
            <PocketPickerField
              look="row"
              only="goals"
              label={c.goal}
              pockets={[]}
              goals={goals}
              value={goal.id}
              onChange={(id) => { setGoalId(id); setSource({ kind: 'account' }); setCurrency(String(rows.find((r) => r.goal.id === id)?.goal.currency ?? currency)) }}
            />
          </MoneySourceField>

          {refusal ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {guard.message(refusal, effective.id)}{refusal === 'no_account_leg' ? ` ${tMoney.noAccountLegHint}` : ''}
            </p>
          ) : pocketShort && fromPocket ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--color-brand-amber)]">
              {c.overPocket(pocketDisplayName(fromPocket, sf.systemNames), formatWhole(fromPocket.currentBalance))}
            </p>
          ) : null}
        </SheetBody>

        <SheetFooter safeArea>
          <Button size="cta-block" disabled={!canSubmit} onClick={save}>
            {c.addToGoal}
          </Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
