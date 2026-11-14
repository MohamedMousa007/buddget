/**
 * A deposit made at a cash machine into the user's own account. The council's decision: it is booked as neither income
 * nor spending but as a transfer from the user's Cash account, flagged `cash_deposit`; the app offers "it was income",
 * which turns it into income, and unanswered it stays a transfer. Only a message naming a machine qualifies, so a deposit
 * someone else made at a branch is untouched. The detector still reports `income`: the message travels the dispatcher
 * and its log row as an income-kind message, so `sms_try_pair` (which matches on the persisted kind) can never claim it
 * as the other leg of an unrelated transfer.
 */
import { normalizeDigits } from '@/lib/sms/normalizeDigits'
import type { SmsExpenseKind } from '@/lib/sms/createSmsExpense'
import { detectLedgerSign } from '@/lib/sms/directionGuard'

const EN_DEPOSIT = /\bdeposit(?:ed)?\b/i
const EN_MACHINE = /\b(?:ATM|CDM|ITM|cash\s+deposit\s+machine|cash\s+machine)\b/i
const AR_DEPOSIT = /إيداع|ايداع/
const AR_MACHINE = /صراف|ماكينة\s*(?:ال)?(?:إيداع|ايداع)/

/**
 * Wording that shares the deposit word but is not money arriving from a cash machine: a fee for depositing, a salary or
 * direct deposit (already income by its own rules), a term or fixed deposit, and any withdrawal.
 */
const NOT_A_CASH_DEPOSIT =
  /\bdeposit\s+fees?\b|\bfees?\s+(?:for|on)\s+(?:a\s+)?(?:cash\s+)?deposit\b|\bdirect\s+deposit\b|\b(?:salary|payroll)\b|\b(?:fixed|term)\s+deposit\b|\bwithdraw(?:n|al)?\b|\bdeposit\s+(?:certificate|account)\b|رسوم\s*(?:ال)?(?:إيداع|ايداع)|راتب|وديعة|سحب/i

export function isCashDeposit(rawText: string): boolean {
  const text = normalizeDigits(rawText)
  if (NOT_A_CASH_DEPOSIT.test(text)) return false
  return (EN_DEPOSIT.test(text) && EN_MACHINE.test(text)) || (AR_DEPOSIT.test(text) && AR_MACHINE.test(text))
}

export interface CashDepositVerdict {
  kind: SmsExpenseKind
  /** True when the row must carry the `cash_deposit` flag. */
  flag: boolean
}

/**
 * The kind a cash deposit travels as: income, whatever the tier said (it is booked as a transfer from cash, see the file
 * header). Left alone: a declined message (a decline books
 * a net-zero row of its own and nothing else, I2) and a message whose own ledger sign says money left.
 */
export function cashDepositVerdict(kind: SmsExpenseKind, rawText: string): CashDepositVerdict {
  if (kind === 'declined' || !isCashDeposit(rawText) || detectLedgerSign(normalizeDigits(rawText)) === 'debit') return { kind, flag: false }
  return { kind: 'income', flag: true }
}
