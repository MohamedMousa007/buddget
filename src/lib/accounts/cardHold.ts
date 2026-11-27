import type { Debt, PaymentMethod } from '@/lib/store/types'
import { cardHoldBack } from '@/lib/debt/computeCreditCardBalance'
import type { LedgerInput } from './balance'
import { canHoldParts } from './kinds'
import { pickPrimaryAccountId } from './primary'
import { resolveAccountId } from './resolve'

/** The live account behind a method id (a debit card resolves to its account); null when none. */
function liveAccount(id: string | undefined, pms: readonly PaymentMethod[]): string | null {
  if (!id) return null
  const acc = resolveAccountId(id, pms)
  return acc && canHoldParts(pms.find((m) => m.id === acc)) ? acc : null
}

/** The account the card was last paid from: its latest payment that came from a live account. */
function lastPayer(card: Debt, input: Pick<LedgerInput, 'paymentMethods' | 'debtPayments'>): string | null {
  const paid = input.debtPayments
    .filter((p) => p.debtId === card.id && p.paymentMethodId)
    .sort((a, b) => (b.occurredAt ?? b.date).localeCompare(a.occurredAt ?? a.date))
  for (const p of paid) {
    const acc = liveAccount(p.paymentMethodId, input.paymentMethods)
    if (acc) return acc
  }
  return null
}

/**
 * paysFrom(c) (LOGIC_SPEC §4.1): the card's linked account as it is (an untracked parent shows the hold nowhere, never on
 * another account), else the live account it is set to be paid from, else the live account that last paid it, else the
 * primary account in its currency, else the primary account.
 */
export function paysFrom(card: Debt, input: Pick<LedgerInput, 'paymentMethods' | 'debtPayments'>): string | null {
  const pms = input.paymentMethods
  const method = pms.find((m) => m.id === card.linkedPaymentMethodId)
  const live = pms.filter((m) => canHoldParts(m))
  return method?.parentId
    ?? liveAccount(method?.paysFromPaymentMethodId, pms)
    ?? lastPayer(card, input)
    ?? pickPrimaryAccountId(live.filter((m) => String(m.currency) === String(card.currency)))
    ?? pickPrimaryAccountId(live)
}

/** The Add card form asks which account pays the card only when it hangs under none. */
export const asksPaysFrom = (card: Pick<PaymentMethod, 'type' | 'parentId'>): boolean => card.type === 'credit_card' && !card.parentId

export interface CardHold {
  /** In the paying account's currency. */
  amount: number
  /** A card's currency had no rate to the account's: that card holds back 0 (fail-closed, §4.1) and the figure is approximate. */
  approx: boolean
}

/**
 * cardHold(A) (§4.1) for every paying account at `asOf`: Σ max(0, owed(c) − unbilledPlan(c)) over the counted credit
 * cards it pays. `input` holds the rows up to `asOf`.
 */
export function cardHolds(input: LedgerInput, asOf: number): Map<string, CardHold> {
  const out = new Map<string, CardHold>()
  const pms = input.paymentMethods
  const rows = { expenses: input.expenses, payments: input.debtPayments, debts: input.debts }
  for (const card of input.debts) {
    if (card.debtType !== 'credit_card' || pms.find((m) => m.id === card.linkedPaymentMethodId)?.excluded) continue
    const hold = cardHoldBack(card, rows, input.convert, new Date(asOf))
    if (hold <= 0) continue
    const accountId = paysFrom(card, input)
    const account = accountId ? pms.find((m) => m.id === accountId) : undefined
    if (!account) continue
    const converted = String(account.currency) === String(card.currency) ? hold : input.convert(hold, String(card.currency), String(account.currency))
    const prev = out.get(account.id) ?? { amount: 0, approx: false }
    out.set(account.id, { amount: prev.amount + (converted ?? 0), approx: prev.approx || converted == null })
  }
  return out
}
