'use client'

import type { ComponentType, ReactNode } from 'react'
import { useNavPath } from '@/lib/navigation/navStore'

// Statically imported so every shell view lives in the main bundle — an in-app
// navigation is then a synchronous component swap with zero network fetch,
// which is what makes the App Router segment-fetch wedge structurally
// impossible. Keep keys in sync with `SHELL_PATHS`.
import FlowPage from '@/app/(app)/flow/page'
import PaydaysPage from '@/app/(app)/paydays/page'
import BudgetHistoryPage from '@/app/(app)/budget-history/page'
import DebtsPage from '@/app/(app)/debts/page'
import WealthPage from '@/app/(app)/wealth/page'
import AccountsPage from '@/app/(app)/accounts/page'
import SubscriptionsPage from '@/app/(app)/subscriptions/page'
import GoalsPage from '@/app/(app)/goals/page'
import ReportsPage from '@/app/(app)/reports/page'
import BudgetSetupPage from '@/app/(app)/budget-setup/page'
import StartPage from '@/app/(app)/start/page'
import NotificationsPage from '@/app/(app)/notifications/page'
import SettingsPage from '@/app/(app)/settings/page'
import SettingsProfilePage from '@/app/(app)/settings/profile/page'
import SettingsSmsPage from '@/app/(app)/settings/sms/page'
import SettingsMemoryPage from '@/app/(app)/settings/memory/page'
import SettingsSecurityPage from '@/app/(app)/settings/security/page'

const VIEW_MAP: Record<string, ComponentType> = {
  '/': FlowPage,
  '/flow': FlowPage,
  // Expenses and Income collapsed into Flow; both paths still resolve.
  '/expenses': FlowPage,
  '/income': FlowPage,
  '/paydays': PaydaysPage,
  '/budget-history': BudgetHistoryPage,
  '/debts': DebtsPage,
  '/accounts': AccountsPage,
  '/wealth': WealthPage,
  // Savings and Investment merged into Wealth; both paths still resolve.
  '/savings': WealthPage,
  '/investment': WealthPage,
  '/subscriptions': SubscriptionsPage,
  '/goals': GoalsPage,
  '/reports': ReportsPage,
  '/budget-setup': BudgetSetupPage,
  '/start': StartPage,
  '/notifications': NotificationsPage,
  '/settings': SettingsPage,
  '/settings/profile': SettingsProfilePage,
  '/settings/sms': SettingsSmsPage,
  '/settings/memory': SettingsMemoryPage,
  '/settings/security': SettingsSecurityPage,
}

/**
 * Renders the shell view for the current in-memory path. For any path NOT in
 * the shell map (admin, legal, reset-password, …) it renders `children` — the
 * real App Router segment, which is always correct there because those routes
 * are only ever reached by a full document load.
 */
export function AppViewRouter({ children }: { children: ReactNode }) {
  const path = useNavPath()
  const View = VIEW_MAP[path]
  return View ? <View /> : <>{children}</>
}
