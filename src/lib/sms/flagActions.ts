import { apiFetchAuth } from '@/lib/apiBase'
import { deviceIdHeader } from '@/lib/native/deviceId'

export type FlagActionBody =
  | { action: 'refund_match'; expenseId: string; targetExpenseId: string }
  | { action: 'deposit_income'; expenseId: string }
  | { action: 'wallet_own'; incomeId: string }
  | { action: 'topup_undo'; expenseId: string }

/** Sends a flag answer that changes server-owned columns to /api/sms/flag-action. Resolves false on any failure. */
export async function answerFlagAction(body: FlagActionBody): Promise<boolean> {
  try {
    const res = await apiFetchAuth('/api/sms/flag-action', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await deviceIdHeader()) },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

export const matchRefundToPurchase = (expenseId: string, targetExpenseId: string) => answerFlagAction({ action: 'refund_match', expenseId, targetExpenseId })
export const markDepositIncome = (expenseId: string) => answerFlagAction({ action: 'deposit_income', expenseId })
export const markWalletOwn = (incomeId: string) => answerFlagAction({ action: 'wallet_own', incomeId })
export const undoTopupRepair = (expenseId: string) => answerFlagAction({ action: 'topup_undo', expenseId })
