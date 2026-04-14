import { addDays, format } from 'date-fns'
import {
  computeCreditCardOutstanding,
  getNextCreditCardDueDate,
  minimumPaymentAmount,
} from '@/lib/debt/computeCreditCardBalance'
import { showLocalNotification } from '@/lib/notifications/pushNotifications'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isRecurringDebtDue } from '@/lib/utils/recurringDebtPayments'
import { formatCurrency } from '@/lib/utils/formatters'

const PUSH_KEY = 'buddget-recurring-push-sent'

function loadSent(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(PUSH_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function markSent(id: string, day: string) {
  try {
    const next = { ...loadSent(), [id]: day }
    sessionStorage.setItem(PUSH_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function alreadySent(id: string, day: string): boolean {
  return loadSent()[id] === day
}

/**
 * Fire-and-forget local notifications for recurring debt (due today / due tomorrow).
 * Idempotent per schedule per calendar day.
 */
export function pushRecurringDebtReminders(): void {
  if (typeof window === 'undefined') return
  void (async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const { recurringDebtPayments, debts, expenses, debtPayments, exchangeRates } = useFinanceStore.getState()

    for (const d of debts) {
      if (d.debtType !== 'credit_card' || !d.paymentDueDay) continue
      const nextDue = getNextCreditCardDueDate(d, new Date())
      if (!nextDue || nextDue !== tomorrow) continue
      if (alreadySent(`cc:${d.id}:tom`, today)) continue
      const pays = debtPayments.filter((p) => p.debtId === d.id)
      const outstanding = computeCreditCardOutstanding(d, expenses, pays, exchangeRates)
      const minPay = minimumPaymentAmount(outstanding, d.minimumPaymentPercent)
      await showLocalNotification(
        `💳 Credit card payment due tomorrow`,
        `${d.name} — ${formatCurrency(outstanding, d.currency)} outstanding · Min: ${formatCurrency(minPay, d.currency)} · Full: ${formatCurrency(outstanding, d.currency)}`
      )
      markSent(`cc:${d.id}:tom`, today)
    }

    for (const r of recurringDebtPayments) {
      if (!r.isActive) continue
      const debt = debts.find((d) => d.id === r.debtId)
      if (!debt) continue

      const title = debt.name

      if (r.nextDueDate === tomorrow && !alreadySent(`${r.id}:tom`, today)) {
        await showLocalNotification(
          title,
          `${debt.name} payment of ${r.amount} ${r.currency} is due tomorrow.`
        )
        markSent(`${r.id}:tom`, today)
      }

      if (isRecurringDebtDue(r.nextDueDate) && !alreadySent(`${r.id}:due`, today)) {
        await showLocalNotification(
          title,
          `${debt.name} payment of ${r.amount} ${r.currency} is due today. Confirm payment?`
        )
        markSent(`${r.id}:due`, today)
      }
    }
  })()
}
