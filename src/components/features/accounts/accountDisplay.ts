import type { PaymentMethod } from '@/lib/store/types'
import { PAYMENT_TYPE_META, decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'

/** "CIB" stays "CIB"; "Vodafone Cash" becomes "VC". */
export function monogram(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  if (first.length > 0 && first.length <= 4 && first === first.toUpperCase()) return first
  const letters = name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase()
  return (letters || '?').slice(0, 2)
}

/** Text colour that stays readable on a brand fill. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 'var(--color-brand-on-primary)'
  const n = parseInt(m[1], 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? 'var(--color-brand-text-primary)' : 'white'
}

const NETWORKS: Array<[RegExp, string]> = [
  [/visa/i, 'VISA'], [/master/i, 'MASTERCARD'], [/meeza|ميزة/i, 'MEEZA'], [/amex|american/i, 'AMEX'], [/mada/i, 'MADA'],
]

export function cardNetwork(m: PaymentMethod): string {
  for (const [re, label] of NETWORKS) if (re.test(m.name)) return label
  return decomposePaymentMethodName(m.name, m.last4).provider.slice(0, 10).toUpperCase()
}

export function cardTypeLabel(m: PaymentMethod): string {
  return m.type === 'credit_card' ? 'Credit' : m.type === 'prepaid_card' ? 'Prepaid' : m.type === 'debit_card' ? 'Debit' : PAYMENT_TYPE_META[m.type].label
}

export function accountColor(m: PaymentMethod): string {
  return m.color ?? PAYMENT_TYPE_META[m.type].color
}

/** Integer and decimal parts, so the decimals can be dimmed. */
export function splitMoney(n: number, currency: string): { int: string; dec: string } {
  const digits = ['KWD', 'BHD', 'OMR', 'JOD'].includes(currency) ? 3 : 2
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const k = s.lastIndexOf('.')
  return { int: (n < 0 ? '−' : '') + s.slice(0, k), dec: s.slice(k) }
}

/** "CIB ••2016" is stored as one name; the list shows the provider and the digits separately. */
export function accountTitle(m: PaymentMethod): string {
  return decomposePaymentMethodName(m.name, m.last4).provider
}
