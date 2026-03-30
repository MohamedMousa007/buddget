// Reserved for native push notifications integration
// Wire to FCM (Firebase Cloud Messaging) or web-push
// when deploying to Google Play via PWABuilder TWA wrapper
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { calculateDebtRemaining } from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'

const READ_STORAGE_KEY = 'buddget-notifications-read'

export type AppNotification = {
  id: string
  type: 'budget_alert' | 'debt_reminder' | 'month_end' | 'savings_nudge'
  title: string
  body: string
  severity: 'warning' | 'info' | 'critical'
  createdAt: string
}

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Quota exceeded or private-mode restriction — ignore
  }
}

export function useNotifications() {
  const stats = useMonthlyStats()
  const t = useT()
  const { monthFilter } = useSettingsStore()
  const { debts, debtPayments, budgetCategories } = useFinanceStore(
    useShallow((s) => ({
      debts: s.debts,
      debtPayments: s.debtPayments,
      budgetCategories: s.budgetCategories,
    }))
  )

  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds())

  const notifications = useMemo(() => {
    const list: AppNotification[] = []
    const now = new Date().toISOString()

    for (const cat of budgetCategories) {
      const cap = stats.categoryBudgetCaps[cat.category] ?? 0
      if (cap <= 0) continue
      const spent = stats.categorySpending[cat.category] ?? 0
      const pct = (spent / cap) * 100
      if (pct > 80) {
        list.push({
          id: `budget_alert:${cat.category}:${monthFilter}`,
          type: 'budget_alert',
          title: t.notifications.budgetAlertTitle(cat.category),
          body:
            pct >= 100
              ? t.notifications.budgetAlertBodyOver(pct, cat.category)
              : t.notifications.budgetAlertBodyUnder(pct, cat.category, 100 - Math.round(pct)),
          severity: pct >= 100 ? 'critical' : 'warning',
          createdAt: now,
        })
      }
    }

    for (const debt of debts) {
      const remaining = calculateDebtRemaining(debt, debtPayments)
      if (remaining > 0.0001) {
        list.push({
          id: `debt_reminder:${debt.id}`,
          type: 'debt_reminder',
          title: t.notifications.debtReminderTitle,
          body: t.notifications.debtReminderBody(debt.name),
          severity: 'info',
          createdAt: now,
        })
      }
    }

    if (stats.daysLeft <= 3 && stats.daysLeft >= 0) {
      list.push({
        id: `month_end:${monthFilter}`,
        type: 'month_end',
        title: stats.daysLeft === 0
          ? t.notifications.monthEndTitleLast
          : t.notifications.monthEndTitleDays(stats.daysLeft),
        body:
          stats.daysLeft === 0
            ? t.notifications.monthEndBodyLast
            : t.notifications.monthEndBodyDays(stats.daysLeft),
        severity: stats.daysLeft === 0 ? 'warning' : 'info',
        createdAt: now,
      })
    }

    const hasSavingsExpense = stats.monthlyExpenses.some((e) => e.category === 'Savings')
    if (!hasSavingsExpense) {
      list.push({
        id: `savings_nudge:${monthFilter}`,
        type: 'savings_nudge',
        title: t.notifications.savingsNudgeTitle,
        body: t.notifications.savingsNudgeBody,
        severity: 'info',
        createdAt: now,
      })
    }

    return list
  }, [budgetCategories, debts, debtPayments, monthFilter, stats, t])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  )

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const n of notifications) {
        next.add(n.id)
      }
      saveReadIds(next)
      return next
    })
  }, [notifications])

  return { notifications, unreadCount, markAllRead }
}
