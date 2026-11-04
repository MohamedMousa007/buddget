import { createClient } from '@/lib/supabase/client'
import type { Expense, PaymentMethod } from '@/lib/store/types'
import { answersTo, digitsOf, MIN_PARTIAL_DIGITS, tailsMatch } from '@/lib/accounts/identity/accountRef'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'

/** Same number: identical digits, or one printed shorter than the other with at least three digits in common. */
const sameNumber = (a: string | null, b: string) => {
  const x = digitsOf(a), y = digitsOf(b)
  return x.length >= 2 && (x === y || (Math.min(x.length, y.length) >= MIN_PARTIAL_DIGITS && tailsMatch(x, y)))
}

/**
 * Pure part: the unplaced expenses whose source message printed this number. When both the account's bank and the
 * message's bank are known they must be the same one; a message from another bank is never offered.
 */
export function expensesForTail(
  expenses: readonly Expense[],
  logs: readonly { expense_id: string | null; account_last4: string | null; bank_name?: string | null; sender?: string | null }[],
  tail: string,
  accountBrand: string | null = null,
): Expense[] {
  const ids = new Set(
    logs
      .filter((l) => {
        const brand = resolvePaymentBrandKey(l.bank_name) ?? resolvePaymentBrandKey(l.sender)
        return l.expense_id && sameNumber(l.account_last4, tail) && !(accountBrand && brand && brand !== accountBrand)
      })
      .map((l) => l.expense_id as string),
  )
  return unplacedSmsExpenses(expenses).filter((e) => ids.has(e.id))
}

/** Reads which messages named this number, then picks the matching unplaced expenses from `expenses`. */
export async function findUnplacedForTail(expenses: readonly Expense[], tail: string, accountBrand: string | null = null): Promise<Expense[]> {
  const unplaced = unplacedSmsExpenses(expenses)
  if (unplaced.length === 0) return []
  const { data } = await createClient().from('sms_parse_log')
    .select('expense_id, account_last4, bank_name, sender')
    .in('expense_id', unplaced.map((e) => e.id))
    .not('account_last4', 'is', null)
  return expensesForTail(expenses, data ?? [], tail, accountBrand)
}

export interface UnplacedLog { expense_id: string | null; account_last4: string | null; bank_name: string | null; sender: string | null }

/**
 * The unplaced expenses that can only belong to this account: from the same bank, and either naming a number the account
 * answers to or naming none. A message from another bank, or with another account's number, is never offered.
 */
export function expensesForAccount(expenses: readonly Expense[], logs: readonly UnplacedLog[], account: Pick<PaymentMethod, 'name' | 'last4' | 'last4Aliases' | 'currency'>): Expense[] {
  const brand = resolvePaymentBrandKey(account.name)
  if (!brand) return []
  const mine = new Set(
    logs
      .filter((l) => l.expense_id && (resolvePaymentBrandKey(l.bank_name) ?? resolvePaymentBrandKey(l.sender)) === brand && (!l.account_last4 || answersTo(account, l.account_last4)))
      .map((l) => l.expense_id as string),
  )
  return unplacedSmsExpenses(expenses).filter((e) => mine.has(e.id) && String(e.currency) === String(account.currency))
}

/** Reads the source messages of the unplaced expenses, then keeps the ones that belong to this account. */
export async function findUnplacedForAccount(expenses: readonly Expense[], account: Pick<PaymentMethod, 'name' | 'last4' | 'last4Aliases' | 'currency'>): Promise<Expense[]> {
  const unplaced = unplacedSmsExpenses(expenses)
  if (unplaced.length === 0) return []
  const { data } = await createClient().from('sms_parse_log')
    .select('expense_id, account_last4, bank_name, sender')
    .in('expense_id', unplaced.map((e) => e.id))
  return expensesForAccount(expenses, data ?? [], account)
}
