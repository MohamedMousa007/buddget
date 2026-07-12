import type { Currency, ExpenseCategory, ReceiptItem, ReceiptCharge } from '@/lib/store/types'

export interface ScannedReceipt {
  isReceipt: boolean
  merchant: string
  amount: number
  currency: Currency
  date: string
  category: ExpenseCategory
  /** Whether VAT/tax is already baked into the item prices (vs added on top). */
  taxIncluded: boolean
  confidence: number
  items: ReceiptItem[]
  charges: ReceiptCharge[]
  notes: string
}

/** ISO date (YYYY-MM-DD) for today, local time. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  'EGP',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'OMR',
  'BHD',
  'USD',
]

export const SUPPORTED_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Enjoyment',
  'Rent',
  'Other',
]

const CHARGE_TYPES: ReceiptCharge['type'][] = ['tax', 'service', 'tip', 'discount', 'other']

/** Coerces raw Gemini output into a safe, typed receipt for the review UI. */
export function normaliseReceipt(raw: Record<string, unknown>, fallbackCurrency: Currency): ScannedReceipt {
  const merchant = (raw.merchant as string | undefined)?.trim().slice(0, 60) ?? ''
  const amountRaw = raw.amount
  const amount = typeof amountRaw === 'number'
    ? amountRaw
    : Number(typeof amountRaw === 'string' ? amountRaw.replace(/[^0-9.]/g, '') : 0)

  const currencyRaw = (raw.currency as string | undefined)?.trim().toUpperCase()
  const currency = (SUPPORTED_CURRENCIES as string[]).includes(currencyRaw ?? '')
    ? (currencyRaw as Currency)
    : ((SUPPORTED_CURRENCIES as string[]).includes(fallbackCurrency)
      ? fallbackCurrency
      : 'EGP')

  const categoryRaw = raw.category as string | undefined
  const category = (SUPPORTED_CATEGORIES as string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as ExpenseCategory)
    : 'Other'

  const dateRaw = (raw.date as string | undefined)?.trim() ?? ''
  let date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''
  // Discard AI dates that are in the future or more than 30 days old (misread
  // photos / hallucinated years), then fall back to today's scan date — a
  // missing receipt date is fine, today is the sensible default.
  if (date) {
    const diffDays = (Date.now() - new Date(date + 'T00:00:00').getTime()) / 86400000
    if (diffDays < 0 || diffDays > 30) date = ''
  }
  if (!date) date = todayISO()

  const confidenceRaw = typeof raw.confidence === 'number' ? raw.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  const items = normaliseItems(raw.items)
  const charges = normaliseCharges(raw.charges)

  // Trust the AI's grand total; if it couldn't read one, sum the breakdown
  // ourselves (items + charges, discounts already negative) so a missing total
  // never blocks the save.
  let finalAmount = Number.isFinite(amount) && amount > 0 ? amount : 0
  if (finalAmount <= 0 && items.length > 0) {
    const sum = items.reduce((s, it) => s + it.price, 0) + charges.reduce((s, c) => s + c.amount, 0)
    if (sum > 0) finalAmount = Math.round(sum * 100) / 100
  }

  return {
    // Default true for back-compat with responses parsed before the flag existed.
    isReceipt: raw.isReceipt !== false,
    merchant,
    amount: finalAmount,
    currency,
    date,
    category,
    taxIncluded: raw.taxIncluded !== false,
    confidence,
    items,
    charges,
    notes: (raw.notes as string | undefined)?.toString().slice(0, 120) ?? '',
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value.replace(/[^0-9.-]/g, ''))
  return NaN
}

function normaliseItems(raw: unknown): ReceiptItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      let name = (typeof e.name === 'string' ? e.name : '').trim().slice(0, 60)
      const price = toNumber(e.price)
      if (!name || !Number.isFinite(price)) return []
      let qty = toNumber(e.qty)
      // Safety net when the model leaves a quantity marker in the name ("2x Water", "x2 Water").
      const m = name.match(/^(?:x\s*(\d{1,3})|(\d{1,3})\s*[x×])\s+(.+)/i)
      if (m && !(Number.isFinite(qty) && qty > 0)) {
        qty = Number(m[1] ?? m[2])
        name = m[3].trim()
      }
      return [{ name, price, ...(Number.isFinite(qty) && qty > 0 ? { qty } : {}) }]
    })
    .slice(0, 100)
}

function normaliseCharges(raw: unknown): ReceiptCharge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      const amount = toNumber(e.amount)
      if (!Number.isFinite(amount) || amount === 0) return []
      const type = CHARGE_TYPES.includes(e.type as ReceiptCharge['type'])
        ? (e.type as ReceiptCharge['type'])
        : 'other'
      const label = (typeof e.label === 'string' ? e.label : type).trim().slice(0, 40) || type
      return [{ type, label, amount }]
    })
    .slice(0, 20)
}
