import type { PaymentMethod } from '@/lib/store/types'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { holdsBalance } from '../kinds'
import { answersTo, MIN_ACCOUNT_DIGITS, digitsOf } from './accountRef'

/**
 * The open method that already answers to `tail`, other than `selfId`: saving a card and an account with the same
 * number makes every SMS with it ambiguous, so the form warns before saving. Undefined when the number is free.
 */
export function tailClash(methods: readonly PaymentMethod[], tail: string, selfId?: string): PaymentMethod | undefined {
  if (digitsOf(tail).length < MIN_ACCOUNT_DIGITS) return undefined
  return methods.find((m) => m.id !== selfId && !m.closedAt && !m.provisional && answersTo(m, tail))
}

/**
 * The account an SMS-created provisional "{Bank} ••5521" most likely is: the one open, confirmed account at the same
 * bank that has no number yet. Exactly one, or none (two candidates are never guessed). Accepting teaches it the
 * digits and moves the history (planMerge).
 */
export function mergeCandidateFor(methods: readonly PaymentMethod[], provisionalId: string): PaymentMethod | undefined {
  const p = methods.find((m) => m.id === provisionalId)
  const bank = p?.provisional ? resolvePaymentBrandKey(p.name) : null
  if (!bank) return undefined
  const fits = methods.filter((m) => m.id !== provisionalId && holdsBalance(m.type) && !m.provisional && !m.closedAt
    && !m.last4 && !(m.last4Aliases?.length) && resolvePaymentBrandKey(m.name) === bank)
  return fits.length === 1 ? fits[0] : undefined
}
