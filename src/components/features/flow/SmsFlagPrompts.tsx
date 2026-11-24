'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Banknote, CalendarClock, CreditCard, Copy, Undo2, Wallet } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useActionToast } from '@/components/ui/ActionToast'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { useShortDate } from '@/hooks/useShortDate'
import { useT } from '@/lib/i18n'
import { formatFlex } from '@/lib/utils/formatters'
import { selectFlagPrompts, type FlagPromptTarget } from '@/lib/sms/flagPrompts'
import { isSamePhoneCopy } from '@/lib/sms/smsFlags'
import { syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { markDepositIncome, markWalletOwn, undoTopupRepair } from '@/lib/sms/flagActions'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { RefundPickSheet } from './RefundPickSheet'

/**
 * Registers the questions the server raises about rows it created from bank messages: a possible repeat, an untrusted
 * date, a transfer reading only the AI asserted, a refund with no purchase, a cash deposit, a card top-up, money into an unregistered wallet, a repaired wallet top-up. Not tied to a Flow segment.
 * Nothing is written until the user answers, and every default leaves totals as the server booked them.
 */
export function SmsFlagPrompts() {
  const t = useT()
  const copy = t.prompts.smsFlags
  const shortDate = useShortDate()
  const toast = useActionToast()
  const { removeExpense } = useLinkedDelete()
  const { expenses, incomeEvents, updateExpense, updateIncomeEvent, deleteIncomeEvent, restoreIncomeEvent } = useFinanceStore(
    useShallow((s) => ({
      expenses: s.expenses,
      incomeEvents: s.incomeEvents,
      updateExpense: s.updateExpense,
      updateIncomeEvent: s.updateIncomeEvent,
      deleteIncomeEvent: s.deleteIncomeEvent,
      restoreIncomeEvent: s.restoreIncomeEvent,
    })),
  )
  const { setActiveModal, setEditingExpenseId, setEditingIncomeEventId } = useSettingsStore(
    useShallow((s) => ({ setActiveModal: s.setActiveModal, setEditingExpenseId: s.setEditingExpenseId, setEditingIncomeEventId: s.setEditingIncomeEventId })),
  )
  const [pickFor, setPickFor] = useState<Expense | null>(null)

  const targets = useMemo(() => selectFlagPrompts(expenses, incomeEvents), [expenses, incomeEvents])

  const ack = (kind: FlagPromptTarget['kind'], id: string, flag: string) => {
    const row: { smsFlagsAck?: string[] } | undefined =
      kind === 'expense' ? useFinanceStore.getState().expenses.find((e) => e.id === id) : useFinanceStore.getState().incomeEvents.find((i) => i.id === id)
    if (!row) return
    const smsFlagsAck = [...new Set([...(row.smsFlagsAck ?? []), flag])]
    if (kind === 'expense') updateExpense(id, { smsFlagsAck })
    else updateIncomeEvent(id, { smsFlagsAck })
  }
  const openEditor = (kind: FlagPromptTarget['kind'], id: string) => {
    if (kind === 'expense') {
      setEditingExpenseId(id)
      setActiveModal('editExpense')
    } else {
      setEditingIncomeEventId(id)
      setActiveModal('editIncomeEvent')
    }
  }
  const removeIncome = (event: IncomeEvent) => {
    deleteIncomeEvent(event.id)
    toast(copy.duplicateRemoved, {
      undo: () => {
        if (!restoreIncomeEvent(event)) toast(t.moneyFlows.undoPocketSpent)
      },
      undoLabel: t.common.undo,
    })
  }
  const markTransfer = (e: Expense) => {
    const before = { category: e.category, smsFlagsAck: e.smsFlagsAck ?? [] }
    updateExpense(e.id, { category: 'Transfer', smsFlagsAck: [...new Set([...before.smsFlagsAck, 'model_kind_unproven'])] })
    toast(copy.kindMarkedTransfer, { undo: () => updateExpense(e.id, before), undoLabel: t.common.undo })
  }
  const markCardLoadSpending = (e: Expense) => {
    const before = { category: e.category, paymentMethodId: e.paymentMethodId, toPaymentMethodId: e.toPaymentMethodId, smsFlagsAck: e.smsFlagsAck ?? [] }
    updateExpense(e.id, {
      category: 'Other',
      toPaymentMethodId: undefined,
      paymentMethodId: e.toPaymentMethodId ?? e.paymentMethodId,
      smsFlagsAck: [...new Set([...before.smsFlagsAck, 'card_load'])],
    })
    toast(copy.cardLoadMarkedSpending, { undo: () => updateExpense(e.id, before), undoLabel: t.common.undo })
  }
  const walletOwn = async (inc: IncomeEvent) => {
    const ok = await markWalletOwn(inc.id)
    if (ok) void syncFinanceNow().catch(() => undefined)
    toast(ok ? copy.walletDone : copy.failed)
  }
  const undoTopup = async (e: Expense) => {
    const ok = await undoTopupRepair(e.id)
    if (ok) void syncFinanceNow().catch(() => undefined)
    toast(ok ? copy.topupUndone : copy.failed)
  }
  const depositIncome = async (e: Expense) => {
    const ok = await markDepositIncome(e.id)
    toast(ok ? copy.cashDone : copy.failed)
  }

  const prompts: Prompt[] = []
  for (const target of targets) {
    const { kind, id, flag } = target
    const e = kind === 'expense' ? expenses.find((x) => x.id === id) : undefined
    const inc = kind === 'income' ? incomeEvents.find((x) => x.id === id) : undefined
    const row = e ?? inc
    if (!row) continue
    const amountText = `${formatFlex((e ?? inc)!.amount)} ${(e ?? inc)!.currency}`
    const detail = e
      ? `${e.description} ${formatFlex(e.amount)} ${e.currency} · ${shortDate(e.date.slice(0, 10))}`
      : `${inc!.name} ${formatFlex(inc!.amount)} ${inc!.currency} · ${shortDate(inc!.receivedDate)}`
    const base = { key: `smsflag:${flag}:${id}`, priority: PROMPT_PRIORITY.sms, tone: 'warning' as const }
    const dismiss = () => ack(kind, id, flag)

    if (flag === 'possible_duplicate') {
      prompts.push({
        ...base,
        icon: Copy,
        title: copy.duplicateTitle,
        description: (isSamePhoneCopy(row.smsFlags) ? copy.duplicateSamePhoneBody : copy.duplicateBody)(detail),
        actions: [
          { label: copy.duplicateRemove, variant: 'default', onPress: () => (e ? void removeExpense(e) : removeIncome(inc!)) },
          { label: copy.duplicateKeep, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'date_unsure') {
      prompts.push({
        ...base,
        icon: CalendarClock,
        title: copy.dateTitle,
        description: copy.dateBody(detail),
        actions: [
          { label: copy.dateFix, variant: 'default', onPress: () => openEditor(kind, id) },
          { label: copy.dateRight, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'model_kind_unproven') {
      prompts.push({
        ...base,
        icon: ArrowLeftRight,
        title: copy.kindTitle,
        description: copy.kindBody(detail),
        actions: e
          ? [
              { label: copy.kindTransfer, variant: 'default', onPress: () => markTransfer(e) },
              { label: copy.kindSpending, variant: 'secondary', onPress: dismiss },
            ]
          : [
              { label: copy.kindReview, variant: 'default', onPress: () => openEditor(kind, id) },
              { label: copy.kindIncome, variant: 'secondary', onPress: dismiss },
            ],
      })
    } else if (flag === 'refund_unmatched' && e) {
      prompts.push({
        ...base,
        icon: Undo2,
        title: copy.refundTitle,
        description: copy.refundBody(detail),
        actions: [
          { label: copy.refundChoose, variant: 'default', onPress: () => setPickFor(e) },
          { label: copy.refundLeave, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'card_load' && e) {
      prompts.push({
        ...base,
        icon: CreditCard,
        title: copy.cardLoadTitle,
        description: copy.cardLoadBody(amountText),
        actions: [
          { label: copy.cardLoadSpending, variant: 'default', onPress: () => markCardLoadSpending(e) },
          { label: copy.cardLoadKeep, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'wallet_unregistered' && inc) {
      prompts.push({
        ...base,
        icon: Wallet,
        title: copy.walletTitle,
        description: copy.walletBody(amountText),
        actions: [
          { label: copy.walletOwn, variant: 'default', onPress: () => void walletOwn(inc) },
          { label: copy.walletIncome, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'topup_repaired' && e) {
      prompts.push({
        ...base,
        icon: Wallet,
        title: copy.topupTitle,
        description: copy.topupBody(amountText, e.description),
        actions: [
          { label: copy.topupUndo, variant: 'default', onPress: () => void undoTopup(e) },
          { label: copy.topupKeep, variant: 'secondary', onPress: dismiss },
        ],
      })
    } else if (flag === 'cash_deposit' && e) {
      prompts.push({
        ...base,
        icon: Banknote,
        title: copy.cashTitle,
        description: copy.cashBody(detail),
        actions: [
          { label: copy.cashIncome, variant: 'default', onPress: () => void depositIncome(e) },
          { label: copy.cashOwn, variant: 'secondary', onPress: dismiss },
        ],
      })
    }
  }
  useRegisterPrompts('smsFlags', prompts)
  return <RefundPickSheet refund={pickFor} onClose={() => setPickFor(null)} />
}
