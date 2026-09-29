'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Clock, Link } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { incomeMatches, latePaydays, matchKey } from '@/lib/income/paydayResolution'
import { formatFixed2, formatFlex } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { useT } from '@/lib/i18n'

/** The late-payday and income-match questions, with what answering them writes. */
export function useIncomeResolution() {
  const { incomeSources, incomeEvents, monthStartDay, rates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      monthStartDay: s.settings.monthStartDay,
      rates: s.exchangeRates,
    })),
  )
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  return useMemo(() => {
    const today = new Date()
    const matches = incomeMatches(incomeSources, incomeEvents, monthStartDay, rates, today, dismissed)
    const matched = new Set(matches.map((m) => m.occ.key))
    // A payday with a match waiting is answered by the match, not asked about twice.
    const late = latePaydays(incomeSources, incomeEvents, monthStartDay, today).filter(
      (l) => !matched.has(l.occ.key) && !dismissed.includes(`late:${l.occ.key}`),
    )
    return { matches, late }
  }, [incomeSources, incomeEvents, monthStartDay, rates, dismissed])
}

/**
 * Registers Flow's income questions with the prompt stack: a stray credit that is probably
 * a payday ("Looks like … — link it?", one at a time, most recent first) and paydays past
 * their grace window. Mounted by Flow only while the In segment shows, so a calm month costs
 * zero payday pixels anywhere.
 */
export function IncomePrompts() {
  const t = useT()
  const { matches, late } = useIncomeResolution()
  const { updateIncomeEvent, addIncomeEvent } = useFinanceStore(
    useShallow((s) => ({ updateIncomeEvent: s.updateIncomeEvent, addIncomeEvent: s.addIncomeEvent })),
  )
  const { dismissBanner, openAmountReceived } = useSettingsStore(
    useShallow((s) => ({ dismissBanner: s.dismissBanner, openAmountReceived: s.openAmountReceived })),
  )

  const prompts: Prompt[] = []
  const match = matches[0]
  if (match) {
    const key = matchKey(match.event.id, match.occ.key)
    prompts.push({
      key,
      priority: PROMPT_PRIORITY.match,
      tone: 'positive',
      icon: Link,
      title: t.income.looksLikeTemplate(match.source.name),
      description: t.prompts.matchBody(
        `${formatFlex(match.event.amount)} ${match.event.currency}`,
        shortDate(match.event.receivedDate),
        shortDate(match.occ.dueDate),
      ),
      actions: [
        {
          label: t.prompts.linkIt,
          variant: 'default',
          // §8.0: the payday goes on occurrenceDate; receivedDate keeps the real arrival.
          onPress: () =>
            updateIncomeEvent(match.event.id, { templateId: match.source.id, occurrenceDate: match.occ.dueDate, status: 'confirmed' }),
        },
        { label: t.prompts.keepSeparate, variant: 'secondary', onPress: () => dismissBanner(key) },
      ],
    })
  }
  for (const { source, occ, daysLate } of late) {
    const key = `late:${occ.key}`
    prompts.push({
      key,
      priority: PROMPT_PRIORITY.late,
      tone: 'warning',
      icon: Clock,
      title: t.prompts.lateTitle(source.name, daysLate),
      description: t.prompts.lateBody(`${formatFixed2(occ.amount)} ${occ.currency}`, shortDate(occ.dueDate)),
      actions: [
        { label: t.income.receivedBtn, variant: 'success', onPress: () => openAmountReceived(source.id, occ.key, occ.dueDate.slice(0, 7)) },
        {
          label: t.income.missedBtn,
          variant: 'secondary',
          onPress: () => {
            addIncomeEvent({
              templateId: source.id,
              name: source.name,
              amount: source.amount,
              currency: source.currency,
              sourceType: source.sourceType,
              receivedDate: occ.dueDate,
              occurrenceDate: occ.dueDate,
              status: 'missed',
              ...(source.paymentMethodId ? { paymentMethodId: source.paymentMethodId } : {}),
            })
            dismissBanner(key)
          },
        },
      ],
    })
  }
  useRegisterPrompts('income', prompts)
  return null
}
