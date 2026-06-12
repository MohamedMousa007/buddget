'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useT } from '@/lib/i18n'

const READ_STORAGE_KEY = 'buddget-notifications-read'

export type AppNotification = {
  id: string
  type:
    | 'budget_alert'
    | 'debt_reminder'
    | 'month_end'
    | 'savings_nudge'
    | 'recurring_due'
    | 'recurring_tomorrow'
  title: string
  body: string
  severity: 'warning' | 'info' | 'critical'
  createdAt: string
  /** When `type` is `recurring_due`, user can confirm/snooze from the inbox. */
  recurringId?: string
}

export type ServerNotificationRow = {
  id: string
  /** DB `type` is the severity enum (info|warning|success|error). */
  type: string
  title: string
  message: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  created_at: string
}

/** Map a server severity enum to the inbox's display severity. */
function serverSeverity(type: string): AppNotification['severity'] {
  if (type === 'error') return 'critical'
  if (type === 'warning') return 'warning'
  return 'info'
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
  const { user } = useAuth()
  const stats = useMonthlyStats()
  const t = useT()
  const { monthFilter } = useSettingsStore()
  const budgetCategories = useFinanceStore(useShallow((s) => s.budgetCategories))

  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds())
  const [serverNotifications, setServerNotifications] = useState<ServerNotificationRow[]>([])

  const fetchServerNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = (await res.json()) as { notifications?: ServerNotificationRow[] }
      setServerNotifications(data.notifications ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setServerNotifications([]))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { notifications?: ServerNotificationRow[] }
        if (!cancelled) setServerNotifications(data.notifications ?? [])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const notifications = useMemo(() => {
    const list: AppNotification[] = []
    const now = new Date().toISOString()

    for (const cat of budgetCategories) {
      if (cat.category === 'Savings') continue
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

    // Recurring-debt and month-end alerts are owned by the server cron
    // (/api/cron/notifications) → emitted as notification rows + OS push, and
    // merged into this feed via serverNotifications. Computing them here too
    // would double them on web, so the client only owns budget + savings status.

    const hasSavingsActivity =
      stats.savingsAccountsTotal > 0.0001 ||
      stats.savingsHoldingsTotal > 0.0001 ||
      stats.savingsFromExpenses > 0.0001
    if (!hasSavingsActivity) {
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
  }, [budgetCategories, monthFilter, stats, t])

  const localUnread = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  )

  const serverUnread = useMemo(
    () => serverNotifications.filter((n) => !n.is_read).length,
    [serverNotifications]
  )

  const unreadCount = localUnread + serverUnread

  // Merged feed for the web bell / center: server rows (SMS + cron alerts) plus
  // the client-computed status alerts (budget / savings), newest first. On native
  // these surface as OS push instead (the bell is web-only), so there is no
  // per-platform duplication.
  const mergedNotifications = useMemo<AppNotification[]>(() => {
    const mapped: AppNotification[] = serverNotifications.map((r) => ({
      id: r.id,
      type: (typeof r.metadata?.category === 'string'
        ? r.metadata.category
        : 'info') as AppNotification['type'],
      title: r.title,
      body: r.message ?? '',
      severity: serverSeverity(r.type),
      createdAt: r.created_at,
      // Server-emitted recurring-due rows carry the recurring id so the inbox can
      // still offer confirm/snooze.
      recurringId: typeof r.metadata?.recurringId === 'string' ? r.metadata.recurringId : undefined,
    }))
    return [...mapped, ...notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [serverNotifications, notifications])

  const markAllRead = useCallback(async () => {
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const n of notifications) {
        next.add(n.id)
      }
      saveReadIds(next)
      return next
    })
    if (user) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAllRead: true }),
        })
        void fetchServerNotifications()
      } catch {
        /* ignore */
      }
    }
  }, [notifications, user, fetchServerNotifications])

  const markServerReadByIds = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        void fetchServerNotifications()
      } catch {
        /* ignore */
      }
    },
    [fetchServerNotifications]
  )

  return {
    notifications: mergedNotifications,
    serverNotifications,
    unreadCount,
    markAllRead,
    markServerReadByIds,
    refetchServerNotifications: fetchServerNotifications,
  }
}
