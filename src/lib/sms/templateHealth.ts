/**
 * Soft health oracles — evidence that needs no user and no AI call.
 *
 * These sit below the hard oracles (direction-guard override, zero-variance amount), which are
 * near-certain and quarantine on a single hit. A soft signal is judged as a RATE against the
 * matches a template actually served, so a template with 1000 matches and 3 failures is not
 * treated like one with 5 matches and 3.
 *
 * Every check here is deliberately conservative: a false accusation costs a working template its
 * reach, while a missed one is caught later by the adjudicator or a user. When a check cannot
 * reach a confident verdict it returns nothing rather than guessing.
 */
import type { ObjectiveFields } from '@/lib/sms/templateScope'

export interface SoftSignal {
  code: 'currency_account_mismatch' | 'implausible_amount' | 'implausible_last4' | 'implausible_date' | 'cross_template_contradiction'
  detail: string
}

/** Amounts above this are almost certainly a misparse (a balance, or digits run together). */
const MAX_PLAUSIBLE_AMOUNT = 10_000_000

/** How far a transaction date may sit from the SMS arrival before it looks wrong. */
const MAX_DATE_DRIFT_DAYS = 45

/**
 * R6 — cheap structural sanity on what a template extracted.
 *
 * Catches a capture group pointing at the wrong token in ways that need no context: a negative
 * or absurd amount, a last4 that is not four digits, a date nowhere near when the SMS arrived.
 */
export function checkPlausibility(
  fields: { amount: number | null; last4: string | null; txDay: string | null },
  receivedAtIso: string | null,
): SoftSignal[] {
  const out: SoftSignal[] = []

  if (fields.amount != null && (!(fields.amount > 0) || fields.amount > MAX_PLAUSIBLE_AMOUNT)) {
    out.push({ code: 'implausible_amount', detail: String(fields.amount) })
  }

  // Only judge a last4 the template claimed to capture; absence is not a defect.
  if (fields.last4 != null && !/^\d{4}$/.test(fields.last4)) {
    out.push({ code: 'implausible_last4', detail: fields.last4 })
  }

  if (fields.txDay && receivedAtIso) {
    const tx = Date.parse(`${fields.txDay}T00:00:00Z`)
    const rec = Date.parse(receivedAtIso)
    if (Number.isFinite(tx) && Number.isFinite(rec)) {
      const driftDays = Math.abs(rec - tx) / 86_400_000
      if (driftDays > MAX_DATE_DRIFT_DAYS) {
        out.push({ code: 'implausible_date', detail: `${fields.txDay} vs ${receivedAtIso.slice(0, 10)}` })
      }
    }
  }

  return out
}

/**
 * R4 — the extracted currency contradicts the account it names.
 *
 * If a template says USD but the last4 it captured is a registered EGP account, one of the two
 * captures is wrong. Only fires when the account is registered AND its currency is known, so an
 * unregistered card or a multi-currency account never produces a signal.
 */
export function checkCurrencyAgainstAccount(
  currency: string | null,
  last4: string | null,
  registeredAccounts: ReadonlyArray<{ last4: string | null; currency: string | null }>,
): SoftSignal | null {
  if (!currency || !last4) return null
  const matches = registeredAccounts.filter((a) => a.last4 === last4 && a.currency)
  // Ambiguous (two cards share a last4) or unknown — no verdict.
  if (matches.length !== 1) return null
  const acct = matches[0].currency!
  if (acct.toUpperCase() === currency.toUpperCase()) return null
  return {
    code: 'currency_account_mismatch',
    detail: `template=${currency} account(${last4})=${acct}`,
  }
}

/**
 * R3 — two templates in the same bucket both matched one SMS and disagree.
 *
 * One of them is provably wrong, but not which, so BOTH are reported and the rate decides. This
 * is why it is soft: acting on a single contradiction would punish the correct template half the
 * time.
 */
export function checkCrossTemplateContradiction(
  results: ReadonlyArray<{ templateId: string; fields: ObjectiveFields }>,
): Array<{ templateId: string; signal: SoftSignal }> {
  if (results.length < 2) return []

  const amounts = new Set(
    results.map((r) => (r.fields.amount == null ? 'null' : r.fields.amount.toFixed(2))),
  )
  if (amounts.size < 2) return []

  return results.map((r) => ({
    templateId: r.templateId,
    signal: {
      code: 'cross_template_contradiction' as const,
      detail: `bucket disagreed: ${[...amounts].join(' vs ')}`,
    },
  }))
}
