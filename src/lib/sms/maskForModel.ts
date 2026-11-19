/**
 * The message as the regex-writing model sees it. The model needs the real STRUCTURE of the message to write a pattern
 * that matches it, but not the person in it: names become stand-in words of the same word count and script, and long
 * digit runs (account and card numbers, phones, references) become synthetic digits of the same length. Amounts, dates,
 * currency codes and the last four digits of an account stay, because the pattern has to capture them.
 *
 * The generated regex is then verified against the REAL message on the server, so the real text never has to leave it.
 */
import { EMAIL_RE, URL_PATH_RE, findNameSlots, maskNames } from '@/lib/sms/maskPii'
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'
import { hasPersonCounterparty } from '@/lib/sms/ownName'

const LATIN_STANDINS = ['Alder', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern', 'Gale', 'Heath', 'Iris', 'Juno']
const ARABIC_STANDINS = ['أبجد', 'هوز', 'حطي', 'كلمن', 'سعفص', 'قرشت']
const DIGITS = '5738291046'
const MARK_OPEN = '\uE000'
const MARK_CLOSE = '\uE001'

/** A phone number (international, local with groups, or an Egyptian mobile) is replaced whole; other long digit runs keep their last four. */
const PHONE_LIKE_RE = /\+\d{1,3}(?:[\s-]?\d){7,}|(?<![\d/:.-])0\d{2}[\s-]?\d{3,4}[\s-]?\d{4}(?!\d)|(?<!\d)(?:20)?01[0125]\d{8}(?!\d)/g
/** A run of 5+ digits that is not the integer part of a decimal amount. */
const LONG_RUN_RE = /(?<!\d)\d{5,}(?!\d*[.,]\d)/g
const KEEP_LAST = 4
const KEEP_LAST_MIN_RUN = 8

function standInDigits(digits: string, from: number): string {
  let out = ''
  for (let i = 0; i < digits.length; i++) out += DIGITS[(from + i) % DIGITS.length]
  return out
}

/** `keep` is the amount's integer text: it is a long run too, but the pattern has to capture it. */
function replaceDigits(text: string, keep: string | null, keepNumbers: boolean): string {
  let n = 0
  const phonesMasked = text.replace(PHONE_LIKE_RE, (m) => m.replace(/\d/g, () => DIGITS[n++ % DIGITS.length]!))
  if (keepNumbers) return phonesMasked
  return phonesMasked
    .replace(LONG_RUN_RE, (run) => {
      if (run === keep) return run
      if (run.length < KEEP_LAST_MIN_RUN) return standInDigits(run, n++)
      return standInDigits(run.slice(0, -KEEP_LAST), n++) + run.slice(-KEEP_LAST)
    })
}

export interface ModelView {
  message: string
  /** The merchant the extraction names, shown the same way the message shows it. */
  merchant: string | null
}

/**
 * `keepNumbers` is for the adjudicator, which must judge the amount, date and last four against the message: names and
 * phone-like numbers are still replaced, but no other digit run is. The phone patterns need a leading + or a 0/20-01x
 * mobile prefix, so a plain amount or a compact date is never matched.
 * ponytail: an account or IBAN-length digit run stays visible to the adjudicator; that is the price of never blinding it.
 */
export function maskForModel(
  rawMessage: string,
  extracted: { merchant: string | null; kind: string | null; amount: number | null },
  { keepNumbers = false }: { keepNumbers?: boolean } = {},
): ModelView {
  const seen: Array<[string, string]> = []
  let nth = 0
  const standIn = (original: string, script: 'latin' | 'arabic'): string => {
    const pool = script === 'arabic' ? ARABIC_STANDINS : LATIN_STANDINS
    const upper = script === 'latin' && original === original.toUpperCase() && /[A-Z]/.test(original)
    const words = original.split(/\s+/).filter(Boolean).map(() => {
      const w = pool[nth++ % pool.length]!
      return upper ? w.toUpperCase() : w
    })
    seen.push([original, words.join(' ')])
    // A marker, not the stand-in itself: a Title-Case stand-in would be masked again by the next name detector.
    return `${MARK_OPEN}${seen.length - 1}${MARK_CLOSE}`
  }

  let message = maskNames(normalizeSmsText(rawMessage).replace(EMAIL_RE, 'user@example.com').replace(URL_PATH_RE, '$1/path'), standIn)
    .replace(new RegExp(`${MARK_OPEN}(\\d+)${MARK_CLOSE}`, 'g'), (_m, i: string) => seen[Number(i)]![1])

  // The extraction names the counterparty of a transfer; the slot rule may have missed that exact spelling.
  let merchant = extracted.merchant
  if (merchant) {
    const known = seen.find(([original]) => original.toLowerCase() === merchant!.trim().toLowerCase())
    if (known) merchant = known[1]
    else if (hasPersonCounterparty(extracted.kind)) {
      standIn(merchant, /[\u0600-\u06FF]/.test(merchant) ? 'arabic' : 'latin')
      const replacement = seen[seen.length - 1]![1]
      message = message.split(new RegExp(merchant.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join(replacement)
      merchant = replacement
    }
  }

  message = replaceDigits(message, extracted.amount != null ? String(Math.trunc(extracted.amount)) : null, keepNumbers)
  return { message, merchant }
}

/** A digit run long enough to be an account, card, IBAN or reference number; no plausible amount is printed this long. */
const IDENTIFIER_RUN_RE = /(?<!\d)\d{9,}(?!\d*[.,]\d)/g

export interface ParseView {
  message: string
  /** Puts the real names back into text the model wrote from the masked message. */
  restore: (text: string | null) => string | null
}

/**
 * The message as the main AI parse sees it (QA-36): the counterparty name of a transfer becomes a stand-in, emails and
 * URL paths are replaced, phone-like numbers and digit runs of 9+ become synthetic digits (keeping the last four).
 * Merchants, amounts, balances, dates and short numbers stay: the model needs them to tell the amount from the balance.
 * Everything read after the parse (own name, counterparty hash, reference, last four) still uses the real message.
 */
export function maskForParse(rawMessage: string): ParseView {
  const text = normalizeSmsText(rawMessage).replace(EMAIL_RE, 'user@example.com').replace(URL_PATH_RE, '$1/path')
  const names: Array<[string, string]> = []
  let nth = 0
  let out = ''
  let at = 0
  for (const slot of findNameSlots(text)) {
    if (slot.start < at) continue
    const original = text.slice(slot.start, slot.end)
    const pool = slot.script === 'arabic' ? ARABIC_STANDINS : LATIN_STANDINS
    const upper = slot.script === 'latin' && original === original.toUpperCase()
    const standIn = original.split(/\s+/).filter(Boolean).map(() => {
      const w = pool[nth++ % pool.length]!
      return upper ? w.toUpperCase() : w
    }).join(' ')
    names.push([standIn, original])
    out += text.slice(at, slot.start) + standIn
    at = slot.end
  }
  let n = 0
  const message = (out + text.slice(at))
    .replace(PHONE_LIKE_RE, (m) => m.replace(/\d/g, () => DIGITS[n++ % DIGITS.length]!))
    .replace(IDENTIFIER_RUN_RE, (run) => standInDigits(run.slice(0, -KEEP_LAST), n++) + run.slice(-KEEP_LAST))
  const restore = (value: string | null): string | null =>
    value == null ? value : names.reduce((acc, [standIn, original]) => acc.split(standIn).join(original), value)
  return { message, restore }
}
