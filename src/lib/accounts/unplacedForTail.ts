import { createClient } from '@/lib/supabase/client'
import type { Expense } from '@/lib/store/types'
import { tailsMatch } from '@/lib/accounts/identity/accountRef'
import { unplacedSmsExpenses } from '@/lib/accounts/unplacedSms'

/** Pure part: the unplaced expenses whose source message printed a number that is the same as `tail`. */
export function expensesForTail(
  expenses: readonly Expense[],
  logs: readonly { expense_id: string | null; account_last4: string | null }[],
  tail: string,
): Expense[] {
  const ids = new Set(logs.filter((l) => l.expense_id && tailsMatch(l.account_last4, tail)).map((l) => l.expense_id as string))
  return unplacedSmsExpenses(expenses).filter((e) => ids.has(e.id))
}

/** Reads which messages named this number, then picks the matching unplaced expenses from `expenses`. */
export async function findUnplacedForTail(expenses: readonly Expense[], tail: string): Promise<Expense[]> {
  const unplaced = unplacedSmsExpenses(expenses)
  if (unplaced.length === 0) return []
  const { data } = await createClient().from('sms_parse_log')
    .select('expense_id, account_last4')
    .in('expense_id', unplaced.map((e) => e.id))
    .not('account_last4', 'is', null)
  return expensesForTail(expenses, data ?? [], tail)
}
