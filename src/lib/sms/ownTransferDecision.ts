/**
 * Is this pair of bank messages one transfer between the user's OWN accounts? (docs/launch/S1-sms-audit.md 6c, part 4)
 *
 * Booking a real payment to someone else as an own transfer hides an expense, the worst error this app can make, so
 * no single signal decides. The base signal is the pair itself seen on one device; it needs one more before anything
 * is settled, and anything short of that is put to the user (or left alone), never applied.
 *
 *   device     a debit on account A and a credit on a DIFFERENT account B, captured by the same device, inside the
 *              time window, for the same amount (a fee difference is allowed only when the reference matches)
 *   reference  both messages carry the same payment reference
 *   name       the person named on the outgoing message is the person named on the incoming one (per-user salted hash)
 *   account    the counterparty digits belong to an account of this user (registered or provisional)
 *   answered   the user already said these two accounts are both theirs
 *   profile    the counterparty matches the name on the user's profile
 *
 * Pure. The same account on both legs is money passing through, never an own transfer.
 */
import { createHash } from 'crypto'

export type OwnTransferSignal = 'device' | 'reference' | 'name' | 'account' | 'answered' | 'profile'
export type OwnTransferVerdict = 'settle' | 'ask' | 'none'

export interface PairFacts {
  /** Both legs name an account and the two differ. */
  differentAccounts: boolean
  /** Both legs name the SAME account: pass-through money. */
  sameAccount: boolean
  /** Both legs carry a device id and it is the same one. */
  sameDevice: boolean
  amountsEqual: boolean
  /** The amounts differ by no more than a transfer fee. */
  withinFee: boolean
  sameReference: boolean
  sameCounterpartyHash: boolean
  counterpartyIsOwnAccount: boolean
  counterpartyIsProfileName: boolean
  /** The user's remembered answer for this pair of accounts: true = both mine, false = not a transfer of mine, null = never asked. */
  answered: boolean | null
}

/** Signals that, together with `device`, settle the pair. The profile name only ever supports a question. */
const DECISIVE: ReadonlySet<OwnTransferSignal> = new Set(['reference', 'name', 'account', 'answered'])

export function ownTransferSignals(f: PairFacts): OwnTransferSignal[] {
  const out: OwnTransferSignal[] = []
  if (f.differentAccounts && f.sameDevice && (f.amountsEqual || (f.withinFee && f.sameReference))) out.push('device')
  if (f.sameReference) out.push('reference')
  if (f.sameCounterpartyHash) out.push('name')
  if (f.counterpartyIsOwnAccount) out.push('account')
  if (f.answered === true) out.push('answered')
  if (f.counterpartyIsProfileName) out.push('profile')
  return out
}

/**
 * Strong (the pair on one device plus a decisive signal) settles. Any signal short of that asks the user once.
 * No signal, the same account on both legs, or an earlier "no" does nothing, except that an earlier "no" for a pair
 * whose legs share a payment reference asks again (a shared reference is strong evidence the answer was about
 * another transfer).
 */
export function decideOwnTransfer(f: PairFacts): { verdict: OwnTransferVerdict; signals: OwnTransferSignal[] } {
  if (f.sameAccount) return { verdict: 'none', signals: [] }
  if (f.answered === false) return f.sameReference ? { verdict: 'ask', signals: ownTransferSignals(f) } : { verdict: 'none', signals: [] }
  const signals = ownTransferSignals(f)
  if (signals.includes('device') && signals.some((s) => DECISIVE.has(s))) return { verdict: 'settle', signals }
  // A pair that only "looks close" (similar amounts, no shared device, no other signal) is a coincidence until shown otherwise.
  return { verdict: signals.length > 0 ? 'ask' : 'none', signals }
}

const DIACRITICS = /[ً-ْٰـ]/g

/**
 * A counterparty name as a hash only this user's rows can be compared on. The user id is the salt, so the same person
 * hashes differently for every user and nothing can be joined across users. The name itself is never stored.
 */
export function counterpartyHash(userId: string, name: string | null | undefined): string | null {
  if (!name) return null
  const folded = name.toLowerCase().replace(DIACRITICS, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}]+/gu, ' ').trim()
  if (folded.split(' ').filter((p) => [...p].length >= 2).length < 2) return null
  return createHash('sha256').update(`${userId}|${folded}`).digest('hex').slice(0, 32)
}

/**
 * A payment reference as a hash only this user's rows can be compared on, kept on the log row after the message text
 * is purged. Case-folded because banks print the same reference in either case. The reference itself is never stored.
 */
export function referenceHash(userId: string, reference: string | null | undefined): string | null {
  if (!reference) return null
  return createHash('sha256').update(`${userId}|${reference.toLowerCase()}`).digest('hex').slice(0, 32)
}
