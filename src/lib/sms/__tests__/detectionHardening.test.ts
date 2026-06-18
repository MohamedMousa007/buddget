import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractKeywords } from '../keywordExtractor'
import { resolveCurrency } from '../currencyResolver'

// ── keywordExtractor ────────────────────────────────────────────────────────
describe('extractKeywords', () => {
  it('tokenizes Arabic + Latin and drops digits/URLs/PII', () => {
    const sms =
      'تم شحن رصيد موبايلك ب 175 وخصم 250 من محفظتك http://vf.eg/vfcash 01012276820'
    const tokens = extractKeywords(sms).map((t) => t.keyword)
    // Real vocabulary survives…
    expect(tokens).toContain('شحن')
    expect(tokens).toContain('موبايلك')
    expect(tokens).toContain('وخصم')
    expect(tokens).toContain('محفظتك')
    // …digits, URLs and phone numbers do NOT.
    expect(tokens).not.toContain('175')
    expect(tokens).not.toContain('250')
    expect(tokens.some((t) => t.includes('vf.eg') || t.includes('http'))).toBe(false)
    expect(tokens.some((t) => /\d/.test(t))).toBe(false)
  })

  it('drops stoplist filler and classifies language', () => {
    const out = extractKeywords('Your account was debited EGP from Carrefour')
    const words = out.map((t) => t.keyword)
    expect(words).not.toContain('your')
    expect(words).not.toContain('account')
    expect(words).toContain('debited')
    expect(out.find((t) => t.keyword === 'debited')?.lang).toBe('en')
    expect(extractKeywords('تم خصم').find((t) => t.keyword === 'خصم')?.lang).toBe('ar')
  })

  it('de-duplicates and ignores short tokens', () => {
    const out = extractKeywords('pay pay paid paid to to')
    const counts = out.filter((t) => t.keyword === 'paid')
    expect(counts.length).toBe(1)
    expect(out.some((t) => t.keyword === 'to')).toBe(false) // stoplist + len 2
  })
})

// ── resolveCurrency ─────────────────────────────────────────────────────────
function makeService(opts: { learned?: { currency: string; confirmed: boolean } | null; base?: string | null }): SupabaseClient {
  const chain = (table: string) => ({
    select() { return this },
    eq() { return this },
    async maybeSingle() {
      if (table === 'sms_sender_currency') return { data: opts.learned ?? null }
      if (table === 'profiles') return { data: opts.base === undefined ? null : { base_currency: opts.base } }
      return { data: null }
    },
  })
  return { from: (t: string) => chain(t) } as unknown as SupabaseClient
}

describe('resolveCurrency', () => {
  const base = { userId: 'u1', sender: 'VF-CASH' }

  it('1. trusts a literal currency present in the body (not provisional)', async () => {
    const svc = makeService({}) // DB should not be needed
    const r = await resolveCurrency(svc, { ...base, rawBody: 'spent EGP 50 at X', parsedCurrency: 'EGP' })
    expect(r).toEqual({ currency: 'EGP', provisional: false })
  })

  it('2. uses a confirmed learned (user,sender) mapping (not provisional)', async () => {
    const svc = makeService({ learned: { currency: 'AED', confirmed: true } })
    const r = await resolveCurrency(svc, { ...base, rawBody: 'no currency here 250', parsedCurrency: null })
    expect(r).toEqual({ currency: 'AED', provisional: false })
  })

  it('3. uses an unconfirmed learned guess (provisional)', async () => {
    const svc = makeService({ learned: { currency: 'EGP', confirmed: false } })
    const r = await resolveCurrency(svc, { ...base, rawBody: 'وخصم 250 من محفظتك', parsedCurrency: null })
    expect(r).toEqual({ currency: 'EGP', provisional: true })
  })

  it('4. falls back to the profile base currency (provisional)', async () => {
    const svc = makeService({ learned: null, base: 'SAR' })
    const r = await resolveCurrency(svc, { ...base, rawBody: 'وخصم 250', parsedCurrency: null })
    expect(r).toEqual({ currency: 'SAR', provisional: true })
  })

  it('5. ultimately defaults to EGP when nothing is known (provisional)', async () => {
    const svc = makeService({ learned: null, base: null })
    const r = await resolveCurrency(svc, { ...base, rawBody: '250', parsedCurrency: null })
    expect(r).toEqual({ currency: 'EGP', provisional: true })
  })

  it('ignores a model-inferred currency when no literal is in the body (still provisional)', async () => {
    // parsedCurrency present but body has no currency token → treat as inferred.
    const svc = makeService({ learned: null, base: 'EGP' })
    const r = await resolveCurrency(svc, { ...base, rawBody: 'وخصم 250 من محفظتك', parsedCurrency: 'USD' })
    expect(r.provisional).toBe(true)
    expect(r.currency).toBe('EGP')
  })
})

// ── isBusinessSender (TS mirror of the Kotlin SmsReceiver logic) ─────────────
// Locks the on-device forward gate: alphanumeric IDs + short codes are business
// senders; long numeric phone numbers are personal.
function isBusinessSender(sender: string | null): boolean {
  const s = (sender ?? '').trim().replace(/^\+/, '')
  if (!s) return false
  if (/[A-Za-z]/.test(s)) return true
  const digits = (s.match(/\d/g) ?? []).length
  return digits >= 1 && digits <= 7
}

describe('isBusinessSender (mirror)', () => {
  it('treats alphanumeric IDs and short codes as business senders', () => {
    expect(isBusinessSender('VF-Cash')).toBe(true)
    expect(isBusinessSender('CIB')).toBe(true)
    expect(isBusinessSender('19666')).toBe(true)
    expect(isBusinessSender('5000')).toBe(true)
  })
  it('treats long numeric phone numbers as personal', () => {
    expect(isBusinessSender('01118087576')).toBe(false)
    expect(isBusinessSender('+201234567890')).toBe(false)
  })
  it('handles empty / null', () => {
    expect(isBusinessSender('')).toBe(false)
    expect(isBusinessSender(null)).toBe(false)
  })
})
