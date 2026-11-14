/**
 * The single extraction path for a DB template's regex + mapping rules.
 *
 * Shared deliberately: `/api/sms/parse` uses it to APPLY a template, and the learn-time gates
 * use it to VERIFY a freshly generated one. If verification used a second implementation the
 * two could drift, and a regex could pass the gate but extract something else in production —
 * which is precisely the failure class the gates exist to prevent.
 */
import { isSafeRegexPattern, MAX_TEMPLATE_INPUT_CHARS } from '@/lib/sms/safeRegex'
import { execBounded } from '@/lib/sms/boundedRegex'
import { parseSmsDay } from '@/lib/sms/patterns'
import { normalizeDigits, normalizeSmsText } from '@/lib/sms/normalizeDigits'
import { parseLocalizedAmount } from '@/lib/ui/amountParse'
import { isSmsExpenseKind } from '@/lib/sms/smsKinds'

/**
 * JSONB schema stored in `sms_tracking_templates_ai.mapping_rules`. It is written by the AI,
 * so this is a contract to be validated, not a type to be trusted.
 */
export interface MappingRules {
  /** `removeCommas` is legacy: separators are always stripped. */
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
  /** Guard words (wordingGuard.ts) the learner's own sample contained: they belong to the format, so they are not a hit. */
  guardWords?: string[]
}

export interface TemplateExtraction {
  amount: number
  currency: string | null
  merchant: string | null
  last4: string | null
  counterpartyLast4: string | null
  txDay: string | null
  /** The datetime group exactly as captured (null when the template has none): lets a gate tell "no year" from "wrong group". */
  rawDatetime: string | null
  paymentInstrument: string | null
  bankName: string | null
  kind: string
  /** Character span of each captured group, for span-based checks (see the wrong-token gate). */
  spans: Record<number, [number, number]>
  /** The text the regex matched against; `spans` index THIS string. */
  matchedText: string
}

export interface ApplyOptions {
  /** SMS receive time: the year of a year-less printed date comes from it. */
  receivedAt?: string | Date | null
}

/** Trailing 4 digits of a masked account/card (a 3-digit capture is left-padded), or null when the capture holds no digits. */
export function cleanLast4(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '').slice(-4)
  if (!digits) return null
  return digits.length === 3 ? `0${digits}` : digits
}

/** Two last4 values name the same account when equal, or when one is the other without its leading zeros (978 vs 0978). */
export function last4Agrees(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a === b || a.replace(/^0+/, '') === b.replace(/^0+/, '')
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
  rawMessage: string,
  regexPattern: string,
  rules: MappingRules,
  opts: ApplyOptions = {},
): TemplateExtraction | null {
  // The kind is a free string the model wrote into a JSON column; an unknown one is no match, so the message falls to the next tier.
  if (!isSmsExpenseKind(rules.kind)) return null
  if (!isSafeRegexPattern(regexPattern)) {
    console.warn('[sms/templateApply] template skipped: unsafe regex', regexPattern.slice(0, 80))
    return null
  }
  try {
    new RegExp(regexPattern, 'd')
  } catch {
    return null
  }

  // Normalised text first (marks stripped, Arabic digits mapped); the digit-only form is the legacy
  // fallback for stored regexes that embed a bidi mark literally.
  const normalised = normalizeSmsText(rawMessage).slice(0, MAX_TEMPLATE_INPUT_CHARS)
  const legacy = normalizeDigits(rawMessage).slice(0, MAX_TEMPLATE_INPUT_CHARS)
  let message = normalised
  let m: RegExpExecArray | null
  try {
    m = execBounded(regexPattern, 'd', message)
    if (!m && legacy !== normalised) {
      message = legacy
      m = execBounded(regexPattern, 'd', message)
    }
  } catch {
    return null
  }
  if (!m) return null

  try {
    const cRules = rules.currency
    const currency = !cRules
      ? null
      : 'literal' in cRules
        ? cRules.literal
        : (m[cRules.group] ?? null)

    const amount = parseLocalizedAmount(m[rules.amount.group] ?? '', currency ?? undefined)
    if (!amount || !Number.isFinite(amount)) return null

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

    const rawDatetime = rules.datetime ? (m[rules.datetime.group] ?? null) : null

    return {
      amount,
      currency,
      merchant: rules.merchant ? (m[rules.merchant.group] ?? null) : null,
      last4: cleanLast4(rules.last4 ? m[rules.last4.group] : null),
      counterpartyLast4: cleanLast4(rules.counterparty_last4 ? m[rules.counterparty_last4.group] : null),
      txDay: parseSmsDay(rawDatetime, opts.receivedAt),
      rawDatetime,
      paymentInstrument: rules.payment_instrument?.literal ?? null,
      bankName: rules.bank_name?.literal ?? null,
      kind: rules.kind,
      spans,
      matchedText: message,
    }
  } catch {
    return null
  }
}
