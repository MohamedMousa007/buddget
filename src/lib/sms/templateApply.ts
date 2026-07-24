/**
 * The single extraction path for a DB template's regex + mapping rules.
 *
 * Shared deliberately: `/api/sms/parse` uses it to APPLY a template, and the learn-time gates
 * use it to VERIFY a freshly generated one. If verification used a second implementation the
 * two could drift, and a regex could pass the gate but extract something else in production —
 * which is precisely the failure class the gates exist to prevent.
 */
import { parseSmsDay } from '@/lib/sms/patterns'

/**
 * JSONB schema stored in `sms_tracking_templates_ai.mapping_rules`. It is written by the AI,
 * so this is a contract to be validated, not a type to be trusted.
 */
export interface MappingRules {
  amount: { group: number; removeCommas?: boolean }
  currency?: { group: number } | { literal: string }
  merchant?: { group: number }
  last4?: { group: number }
  /**
   * Transaction date printed in the SMS. Without it a template-parsed row is dated by ARRIVAL,
   * which is wrong for any delayed or offline delivery.
   */
  datetime?: { group: number }
  /**
   * Destination/counterparty account last4 — dispatch's own-account transfer detection keys on
   * it, so a template that cannot capture it can never be recognised as an own transfer.
   */
  counterparty_last4?: { group: number }
  /** card | account | wallet */
  payment_instrument?: { literal: string }
  kind: string
  bank_name?: { literal: string }
}

export interface TemplateExtraction {
  amount: number
  currency: string | null
  merchant: string | null
  last4: string | null
  counterpartyLast4: string | null
  txDay: string | null
  paymentInstrument: string | null
  bankName: string | null
  kind: string
  /** Character span of each captured group, for span-based checks (see the wrong-token gate). */
  spans: Record<number, [number, number]>
}

/** Trailing 4 digits of a masked account/card, or null when the capture holds no digits. */
export function cleanLast4(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.replace(/\D/g, '').slice(-4) || null
}

/**
 * Runs `regexPattern` over `message` and maps the captures per `rules`.
 * Returns null when the regex does not compile, does not match, or yields no usable amount.
 *
 * Compiled with the `d` flag so capture spans are available — the wrong-token gate needs the
 * amount's POSITION, not just its value, to tell a real amount from a balance that happens to
 * be the same number.
 */
export function applyMappingRules(
  message: string,
  regexPattern: string,
  rules: MappingRules,
): TemplateExtraction | null {
  let re: RegExp
  try {
    re = new RegExp(regexPattern, 'd')
  } catch {
    return null
  }

  let m: RegExpExecArray | null
  try {
    m = re.exec(message)
  } catch {
    return null
  }
  if (!m) return null

  try {
    const rawAmt = m[rules.amount.group] ?? ''
    const amtStr = rules.amount.removeCommas ? rawAmt.replace(/,/g, '') : rawAmt
    const amount = parseFloat(amtStr)
    if (!amount || !Number.isFinite(amount)) return null

    const cRules = rules.currency
    const currency = !cRules
      ? null
      : 'literal' in cRules
        ? cRules.literal
        : (m[cRules.group] ?? null)

    const spans: Record<number, [number, number]> = {}
    // `indices` is present because of the `d` flag; guarded for safety since the flag is
    // applied at runtime rather than by the type system.
    const indices = (m as RegExpExecArray & { indices?: Array<[number, number] | undefined> }).indices
    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        const span = indices[i]
        if (span) spans[i] = span
      }
    }

    return {
      amount,
      currency,
      merchant: rules.merchant ? (m[rules.merchant.group] ?? null) : null,
      last4: cleanLast4(rules.last4 ? m[rules.last4.group] : null),
      counterpartyLast4: cleanLast4(rules.counterparty_last4 ? m[rules.counterparty_last4.group] : null),
      txDay: parseSmsDay(rules.datetime ? (m[rules.datetime.group] ?? null) : null),
      paymentInstrument: rules.payment_instrument?.literal ?? null,
      bankName: rules.bank_name?.literal ?? null,
      kind: rules.kind,
      spans,
    }
  } catch {
    return null
  }
}
