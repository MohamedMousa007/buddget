/** Where a tap on a cron push (`data.notifType`) opens the app. Unknown types return null and keep the last screen. */
const ROUTES: Record<string, string> = {
  recurring_due: '/debts',
  recurring_tomorrow: '/debts',
  subscription_digest: '/subscriptions',
  subscription_trial: '/subscriptions',
  subscription_price: '/subscriptions',
  goal_behind: '/goals',
  goal_milestone: '/goals',
  goal_achieved: '/goals',
  savings_carry: '/wealth',
  savings_nudge: '/wealth',
  month_end: '/reports',
}

export function routeForNotifType(notifType: string | undefined): string | null {
  return notifType ? (ROUTES[notifType] ?? null) : null
}
