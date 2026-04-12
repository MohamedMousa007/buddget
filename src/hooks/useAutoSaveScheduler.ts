'use client'

import { useEffect } from 'react'
import { format, getDate, getDay, isLastDayOfMonth } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  calculateLeftToSpendCashFlow,
  calculateMonthlyIncome,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'

function notify(body: string) {
  if (typeof globalThis.Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification('Buddget', { body })
  }
}

/**
 * Runs due auto-save rules on an interval (fixed schedule, end-of-month sweep, percent reminder).
 */
export function useAutoSaveScheduler() {
  useEffect(() => {
    const tick = () => {
      const state = useFinanceStore.getState()
      const monthFilter = useSettingsStore.getState().monthFilter
      const today = new Date()
      const monthKey = format(today, 'yyyy-MM')
      const incomeBlocked =
        state.settings.noIncomeDeclared === true && state.incomeSources.length === 0

      for (const acc of state.savingsAccounts) {
        const as = acc.autoSave
        if (!as?.enabled) continue

        if (as.mode === 'fixed_schedule' && as.amount && as.amount > 0) {
          const freq = as.frequency ?? 'monthly'
          if (freq === 'monthly') {
            const dom = Math.min(28, Math.max(1, as.dayOfMonth ?? 1))
            if (getDate(today) !== dom) continue
            if (as.lastRunKey === monthKey) continue
            state.depositToSavings(acc.id, as.amount, acc.currency, undefined, { isAutoSave: true })
            state.updateSavingsAccount(acc.id, { autoSave: { ...as, lastRunKey: monthKey } })
            notify(`${as.amount} ${acc.currency} auto-saved to ${acc.name}`)
          } else {
            const wd = as.weekday ?? 1
            if (getDay(today) !== wd) continue
            const dayKey = format(today, 'yyyy-MM-dd')
            if (as.lastRunKey === dayKey) continue
            state.depositToSavings(acc.id, as.amount, acc.currency, undefined, { isAutoSave: true })
            state.updateSavingsAccount(acc.id, { autoSave: { ...as, lastRunKey: dayKey } })
            notify(`${as.amount} ${acc.currency} auto-saved to ${acc.name}`)
          }
          continue
        }

        if (as.mode === 'end_of_month' && isLastDayOfMonth(today)) {
          if (as.lastRunKey === monthKey) continue
          const left = calculateLeftToSpendCashFlow({
            monthStr: monthFilter,
            monthStartDay: state.settings.monthStartDay,
            expenses: state.expenses,
            incomeSources: state.incomeSources,
            savingsTransactions: state.savingsTransactions,
            baseCurrency: state.settings.baseCurrency,
            exchangeRates: state.exchangeRates,
            incomeBlocked,
          })
          if (left <= 0.0001) {
            state.updateSavingsAccount(acc.id, { autoSave: { ...as, lastRunKey: monthKey } })
            notify(`Nothing left to sweep for ${acc.name}`)
            continue
          }
          const amount = convertCurrency(
            left,
            state.settings.baseCurrency,
            acc.currency,
            state.exchangeRates
          )
          if (amount > 0.0001) {
            state.depositToSavings(acc.id, amount, acc.currency, 'End of month sweep', {
              isAutoSave: true,
            })
            notify(`Swept to ${acc.name}`)
          }
          state.updateSavingsAccount(acc.id, { autoSave: { ...as, lastRunKey: monthKey } })
          continue
        }

        if (as.mode === 'percent_of_income' && as.percent && as.percent > 0) {
          if (as.lastRunKey === monthKey) continue
          const inc = calculateMonthlyIncome(
            state.incomeSources,
            state.settings.baseCurrency,
            state.exchangeRates
          )
          if (incomeBlocked || inc <= 0) continue
          const suggested = (as.percent / 100) * inc
          const inAcc = convertCurrency(
            suggested,
            state.settings.baseCurrency,
            acc.currency,
            state.exchangeRates
          )
          notify(`${as.percent}% of income ≈ ${inAcc.toFixed(0)} ${acc.currency} — open Savings to confirm`)
          state.updateSavingsAccount(acc.id, { autoSave: { ...as, lastRunKey: monthKey } })
        }
      }
    }

    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
}
