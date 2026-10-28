import { normalizeSmsText } from '@/lib/sms/normalizeDigits'

/**
 * Masking and leak detection for text that outlives the raw SMS (the learning corpus, learned regexes).
 * `maskPii` removes personal details; `scanForLeaks` is the independent check that finds what is left.
 * Both share the same detectors so a gap closed in one is closed in the other. Neither ever returns the
 * matched text: findings carry a kind and a count only, so a log of them cannot leak what they found.
 */

/** Words that begin with a capital in bank wording but are never part of a person's name. */
const COMMON_WORDS = new Set([
  'your', 'you', 'the', 'this', 'that', 'for', 'from', 'with', 'and', 'dear', 'thank', 'thanks', 'account', 'acct', 'card',
  'credit', 'debit', 'prepaid', 'visa', 'mastercard', 'meeza', 'amex', 'payment', 'purchase', 'transfer', 'transaction',
  'withdrawal', 'deposit', 'balance', 'available', 'limit', 'bank', 'mobile', 'banking', 'online', 'details', 'visit',
  'call', 'customer', 'service', 'care', 'apple', 'google', 'pay', 'instant', 'wallet', 'cash', 'atm', 'pos', 'fees',
  'fee', 'charge', 'charged', 'refund', 'salary', 'installment', 'statement', 'due', 'date', 'amount', 'ref', 'reference',
  'number', 'successful', 'successfully', 'failed', 'declined', 'received', 'sent', 'ending', 'over', 'new', 'has', 'was',
  'vodafone', 'hsbc', 'cib', 'nbe', 'qnb', 'egypt', 'egyptian', 'national', 'misr', 'alexandria', 'emirates', 'mashreq', 'snb', 'fawry', 'instapay', 'ipn', 'banque', 'been', 'have', 'will', 'please', 'contact', 'security', 'code', 'otp', 'pin', 'password', 'do', 'not', 'share', 'with',
])

const ARABIC_COMMON = new Set([
  'حساب', 'حسابك', 'الحساب', 'بطاقة', 'بطاقتك', 'البطاقة', 'رصيد', 'رصيدك', 'الرصيد', 'مبلغ', 'عملية', 'العملية', 'تحويل',
  'الحساب', 'حسابكم', 'المتاح', 'متاح', 'خلال', 'قبل', 'تاريخ', 'الساعة', 'اجمالي', 'إجمالي', 'شركة', 'متجر', 'موقع', 'تطبيق', 'الخاصة', 'الخاص', 'بنك', 'البنك', 'خدمة', 'العملاء', 'رقم', 'مرجع',
])

/** A cue word that introduces a person name in Arabic bank wording; the 1-3 words after it are masked. */
const AR_STRONG_CUES = 'السيد|السيدة|الأستاذ|الاستاذ|عزيزي|عزيزتي|العميل|العميلة|باسم|المستفيد|المرسل|لصالح'
const AR_NAME_CUE = `(?:${AR_STRONG_CUES}|إلى|الى|من)`
const AR_WORD = '[\\u0621-\\u064a]{2,}'
const arNameRe = (cue: string) => new RegExp(`(${cue})\\s+(${AR_WORD}(?:\\s+${AR_WORD}){0,2})`, 'gu')
const AR_NAME_RE = arNameRe(AR_NAME_CUE)
const AR_STRONG_NAME_RE = arNameRe(`(?:${AR_STRONG_CUES})`)

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URL_PATH_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,})(\/(?!<PATH>)[^\s]{6,})/gi
const PHONE_RE = /(?<![\d#])\+?\d(?:[\s-]?\d){8,}(?!\d)/g
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g
const ALLCAPS_RUN_RE = /\b[A-Z][A-Z'’-]{2,}(?:\s+[A-Z][A-Z'’-]{2,})+\b/g
const TITLE_RUN_RE = /\b[A-Z][a-z'’-]{2,}(?:\s+[A-Z][a-z'’-]{2,})+\b/g

function isCommonRun(run: string): boolean {
  return run.split(/\s+/).every((w) => COMMON_WORDS.has(w.toLowerCase()))
}

function arabicNameWords(words: string): boolean {
  const first = words.split(/\s+/)[0]
  return !ARABIC_COMMON.has(first)
}

/**
 * Masks what identifies a person or an account: emails, URL paths and queries, phone-like and long digit
 * runs, IBANs, ALL-CAPS and Title-Case names, and Arabic names after a name cue. Amounts of 4+ integer
 * digits are masked; small amounts and decimals stay readable (wording is the point of the corpus).
 */
export function maskPii(body: string): string {
  return normalizeSmsText(body)
    .replace(EMAIL_RE, '<EMAIL>')
    .replace(URL_PATH_RE, '$1/<PATH>')
    .replace(IBAN_RE, '<ACCT>')
    .replace(PHONE_RE, '<PHONE>')
    .replace(/\d[\d,]{3,}(?:\.\d+)?/g, '#####')
    .replace(/\*{2,}\d+/g, '****')
    .replace(ALLCAPS_RUN_RE, (run) => (isCommonRun(run) ? run : '<NAME>'))
    .replace(TITLE_RUN_RE, (run) => (isCommonRun(run) ? run : '<NAME>'))
    .replace(AR_NAME_RE, (whole, cue: string, words: string) => (arabicNameWords(words) ? `${cue} <NAME>` : whole))
}

export type LeakKind = 'email' | 'url_path' | 'phone' | 'long_number' | 'amount' | 'iban' | 'name_caps' | 'name_title' | 'name_arabic' | 'format_mark'

export interface LeakFinding {
  kind: LeakKind
  count: number
}

const AMOUNT_RE = /(?<![\d#])\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)|(?<![\d#])\d+\.\d{2}(?!\d)/g
const LONG_NUMBER_RE = /\d{4,}/g
const FORMAT_MARK_RE = /[‌-‏‪-‮⁦-⁩؜﻿]/g

function count(re: RegExp, text: string, accept: (m: string) => boolean = () => true): number {
  let n = 0
  for (const m of text.matchAll(re)) if (accept(m[0])) n++
  return n
}

/**
 * Finds personal detail left in a string that was supposed to be masked (a corpus row, a correction, a
 * learned-regex literal). Runs on the text as stored, so a `<NAME>` placeholder is clean. Returns kinds
 * and counts only. Used by the tests, the learn gate (per-user literals) and, as the SQL check
 * specified in `LEAK_SCAN_SQL_SPEC`, by the admin check over sms_corpus and sms_corrections.
 */
export function scanForLeaks(text: string, opts: { weakArabicCues?: boolean } = {}): LeakFinding[] {
  const arRe = opts.weakArabicCues === false ? AR_STRONG_NAME_RE : AR_NAME_RE
  const out: LeakFinding[] = []
  const add = (kind: LeakKind, n: number) => { if (n > 0) out.push({ kind, count: n }) }
  add('email', count(EMAIL_RE, text))
  add('url_path', count(URL_PATH_RE, text))
  add('iban', count(IBAN_RE, text))
  add('phone', count(PHONE_RE, text))
  add('long_number', count(LONG_NUMBER_RE, text))
  add('amount', count(AMOUNT_RE, text))
  add('name_caps', count(ALLCAPS_RUN_RE, text, (r) => !isCommonRun(r)))
  add('name_title', count(TITLE_RUN_RE, text, (r) => !isCommonRun(r)))
  add('name_arabic', count(arRe, text, (r) => arabicNameWords(r.replace(/^\S+\s+/u, ''))))
  add('format_mark', count(FORMAT_MARK_RE, text))
  return out
}

/**
 * Specification for the admin leak check (package 3 implements it as an RPC, admin-only, read-only).
 * It must report kinds and counts per table, never the offending text:
 *
 *   -- corpus rows that still contain what the masker should have removed
 *   SELECT 'sms_corpus' AS tbl, count(*) FILTER (WHERE redacted_body ~ '[0-9]{4,}') AS long_number,
 *          count(*) FILTER (WHERE redacted_body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}') AS email,
 *          count(*) FILTER (WHERE redacted_body ~ '[0-9]+\.[0-9]{2}') AS amount,
 *          count(*) FILTER (WHERE redacted_body ~ '[A-Z][a-z]{2,} [A-Z][a-z]{2,}') AS name_title,
 *          count(*) FILTER (WHERE redacted_body ~ '[‌-‏‪-‮⁦-⁩﻿]') AS format_mark
 *   FROM sms_corpus
 *   UNION ALL (same columns over the masked text columns of sms_corrections)
 *
 * The TypeScript `scanForLeaks` is the reference; the SQL is a cheap superset filter (it may over-report
 * Title-Case, never under-report digits, emails or marks).
 */
export const LEAK_SCAN_SQL_SPEC = 'see doc comment: counts per kind over sms_corpus and sms_corrections, no text returned'
