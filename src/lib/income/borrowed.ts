import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

/**
 * Borrowed money is a liability, never income: a credit recorded as borrowed (`sourceType 'debt'`) or linked to the
 * debt it belongs to. It still raises the account it landed in; only income totals leave it out.
 */
export const isBorrowedMoney = (row: Pick<IncomeEvent | IncomeSource, 'sourceType' | 'linkedDebtId'>): boolean =>
  row.sourceType === 'debt' || Boolean(row.linkedDebtId)
