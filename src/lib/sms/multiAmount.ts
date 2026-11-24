import { CURRENCY_CODES } from '@/lib/sms/patterns/currency'

const CURRENCY = `(?:${CURRENCY_CODES.join('|')}|SR|جم|جنيه|ريال|درهم)`
const AMOUNT_WITH_CURRENCY = new RegExp(`${CURRENCY}\\s*[\\d,]+(?:\\.\\d+)?|[\\d,]+(?:\\.\\d+)?\\s*${CURRENCY}`, 'i')
const MOVEMENT = /debited|credited|purchase|paid|payment|transfer|withdraw|deposit|خصم|إيداع|ايداع|تحويل|شراء|سحب|حوالة/i
const BALANCE = /balance|bal\b|available|رصيد|المتاح/i
const LEAD_WORDS = 4

/** The first words of a statement with every digit and mask run folded, so two statements of one template compare equal. */
function lead(sentence: string): string {
  return sentence.toLowerCase().replace(/[\d*xX#]+/g, '#').split(/\s+/).filter(Boolean).slice(0, LEAD_WORDS).join(' ')
}

/**
 * True when one message states two or more movements in the same wording: two sentences that each name an amount with
 * its currency and a movement word before any balance clause, and begin with the same words. Such a message is held for the
 * user and never taught, because a template learned from it reads only the first movement (QA-32). A fee or a balance
 * line in its own words is not a second statement.
 */
export function looksMultiTransaction(message: string): boolean {
  const statements = message
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.split(BALANCE)[0].trim())
    .filter((s) => AMOUNT_WITH_CURRENCY.test(s) && MOVEMENT.test(s))
  const seen = new Set<string>()
  for (const s of statements) {
    const key = lead(s)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}
