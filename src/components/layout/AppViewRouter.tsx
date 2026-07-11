'use client'

import type { ComponentType, ReactNode } from 'react'
import { useNavPath } from '@/lib/navigation/navStore'

// Statically imported so every shell view lives in the main bundle — an in-app
// navigation is then a synchronous component swap with zero network fetch,
// which is what makes the App Router segment-fetch wedge structurally
// impossible. Keep keys in sync with `SHELL_PATHS`.
import DashboardPage from '@/app/page'
import ExpensesPage from '@/app/expenses/page'
import DebtsPage from '@/app/debts/page'
import IncomePage from '@/app/income/page'
import SavingsPage from '@/app/savings/page'
import SubscriptionsPage from '@/app/subscriptions/page'
import GoalsPage from '@/app/goals/page'
import ReportsPage from '@/app/reports/page'
import BudgetSetupPage from '@/app/budget-setup/page'
import NotificationsPage from '@/app/notifications/page'
import SettingsPage from '@/app/settings/page'
import SettingsProfilePage from '@/app/settings/profile/page'
import SettingsAccountPage from '@/app/settings/account/page'
import SettingsCurrencyPage from '@/app/settings/currency/page'
import SettingsDisplayPage from '@/app/settings/display/page'
import SettingsDataPage from '@/app/settings/data/page'
import SettingsSmsPage from '@/app/settings/sms/page'

const VIEW_MAP: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/expenses': ExpensesPage,
  '/debts': DebtsPage,
  '/income': IncomePage,
  '/savings': SavingsPage,
  '/subscriptions': SubscriptionsPage,
  '/goals': GoalsPage,
  '/reports': ReportsPage,
  '/budget-setup': BudgetSetupPage,
  '/notifications': NotificationsPage,
  '/settings': SettingsPage,
  '/settings/profile': SettingsProfilePage,
  '/settings/account': SettingsAccountPage,
  '/settings/currency': SettingsCurrencyPage,
  '/settings/display': SettingsDisplayPage,
  '/settings/data': SettingsDataPage,
  '/settings/sms': SettingsSmsPage,
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
