import type { Currency, ExpenseCategory, ReceiptItem, ReceiptCharge } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { parseLocalizedAmount } from '@/lib/ui/amountParse'

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
  return localTodayISO()
}

export const SUPPORTED_CURRENCIES: Currency[] = FIAT_CURRENCIES

export const SUPPORTED_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Groceries',
  'Fuel',
  'Transport',
  'Shopping',
  'Health',
  'Education',
  'Utilities',
  'Enjoyment',
  'Rent',
  'Other',
]

const CHARGE_TYPES: ReceiptCharge['type'][] = ['tax', 'service', 'tip', 'discount', 'other']

/** Placeholder names the AI emits for lines whose NAME it couldn't read. */
export const UNKNOWN_ITEM_NAMES = ['غير معروف', 'Unknown']

/** True for AI placeholder lines: unreadable name, or unreadable price (0). */
export function isUnknownItem(it: ReceiptItem): boolean {
  return it.price === 0 || UNKNOWN_ITEM_NAMES.includes(it.name)
}

/**
 * Fills the gap between the confirmed total and the breakdown so the saved
 * receipt always reconciles. Positive deficit is distributed equally across
 * unknown-PRICE placeholders (price 0); with none, a single "غير معروف" filler
 * line absorbs it. A breakdown that EXCEEDS the total is left untouched (a
 * duplicated line or missed discount — shrinking lines would hide real data).
 * ponytail: a genuinely-free promo line (real 0.00) is indistinguishable from
 * an unreadable price and may absorb part of the deficit.
 */
export function reconcileMissingItems(
  items: ReceiptItem[],
  charges: ReceiptCharge[],
  amount: number,
): ReceiptItem[] {
  const sum = items.reduce((s, it) => s + it.price, 0) + charges.reduce((s, c) => s + c.amount, 0)
  const deficit = Math.round((amount - sum) * 100) / 100
  if (deficit <= 0.01) return items

  const zeroIdx = items.map((it, i) => (it.price === 0 ? i : -1)).filter((i) => i >= 0)
  if (zeroIdx.length === 0) {
    return [...items, { name: UNKNOWN_ITEM_NAMES[0], price: deficit }]
  }

  const share = Math.floor((deficit / zeroIdx.length) * 100) / 100
  const next = [...items]
  zeroIdx.forEach((idx, n) => {
    const isLast = n === zeroIdx.length - 1
    const price = isLast ? Math.round((deficit - share * (zeroIdx.length - 1)) * 100) / 100 : share
    next[idx] = { ...next[idx], price }
  })
  return next
}

/** Coerces raw Gemini output into a safe, typed receipt for the review UI. */
export function normaliseReceipt(raw: Record<string, unknown>, fallbackCurrency: Currency): ScannedReceipt {
  const merchant = (raw.merchant as string | undefined)?.trim().slice(0, 60) ?? ''
  const currencyRaw = (raw.currency as string | undefined)?.trim().toUpperCase()
  const currency = (SUPPORTED_CURRENCIES as string[]).includes(currencyRaw ?? '')
    ? (currencyRaw as Currency)
    : ((SUPPORTED_CURRENCIES as string[]).includes(fallbackCurrency)
      ? fallbackCurrency
      : 'EGP')

  const amount = toNumber(raw.amount, currency)

  const categoryRaw = raw.category as string | undefined
  const category = (SUPPORTED_CATEGORIES as string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as ExpenseCategory)
    : 'Other'

  const dateRaw = (raw.date as string | undefined)?.trim() ?? ''
  // A printed date is kept as-is, old or future: the review screen shows it and the user
  // can edit it. Only a missing/unparseable date falls back to the scan day.
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && !Number.isNaN(new Date(dateRaw + 'T00:00:00').getTime())
  const date = validDate ? dateRaw : todayISO()

  const confidenceRaw = typeof raw.confidence === 'number' ? raw.confidence : 0.5
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  const items = normaliseItems(raw.items, currency)
  const charges = normaliseCharges(raw.charges, currency)

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

function toNumber(value: unknown, currency: Currency): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN
  const negative = /^\s*[-\u2212(]/.test(value)
  const n = parseLocalizedAmount(value, currency)
  return negative ? -n : n
}

function normaliseItems(raw: unknown, currency: Currency): ReceiptItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      let name = (typeof e.name === 'string' ? e.name : '').trim().slice(0, 60)
      const price = toNumber(e.price, currency)
      if (!name || !Number.isFinite(price)) return []
      let qty = toNumber(e.qty, currency)
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

function normaliseCharges(raw: unknown, currency: Currency): ReceiptCharge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      const amount = toNumber(e.amount, currency)
      if (!Number.isFinite(amount) || amount === 0) return []
      const type = CHARGE_TYPES.includes(e.type as ReceiptCharge['type'])
        ? (e.type as ReceiptCharge['type'])
        : 'other'
      const label = (typeof e.label === 'string' ? e.label : type).trim().slice(0, 40) || type
      return [{ type, label, amount }]
    })
    .slice(0, 20)
}
