'use client'

/**
 * Recurring debt reminders are now delivered server-side as OS push + in-app
 * notifications (see /api/cron/notifications). This hook is retained as the
 * mount point for any future client-side recurring-debt scheduling; payments
 * still post only after the user confirms in-app (`confirmRecurringDebtPayment`).
 */
export function useRecurringDebtPaymentScheduler() {
  // No client-side reminder side effects — handled by the server cron.
}
