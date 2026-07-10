import type { PaymentMethodType } from '@/lib/store/types'

/** Per-type metadata (handoff §3 / v4). Icons resolve to Lucide via {@link paymentTypeIcon}. */
export const PAYMENT_TYPE_META: Record<
  PaymentMethodType,
  { label: string; color: string; allowsLast4: boolean }
> = {
  cash: { label: 'Cash', color: '#C9C9D4', allowsLast4: false },
  bank_account: { label: 'Bank account', color: '#22C55E', allowsLast4: true },
  debit_card: { label: 'Debit card', color: '#A855F7', allowsLast4: true },
  credit_card: { label: 'Credit card', color: '#3B82F6', allowsLast4: true },
  prepaid_card: { label: 'Prepaid card', color: '#2DD4BF', allowsLast4: true },
  wallet: { label: 'Wallet', color: '#FB923C', allowsLast4: false },
  bnpl: { label: 'BNPL', color: '#EC4899', allowsLast4: false },
  other: { label: 'Other', color: '#9CA3AF', allowsLast4: false },
}

/** The 7 user-choosable setup types — Cash is implicit and never offered (handoff §3). */
export const SETUP_TYPES: PaymentMethodType[] = [
  'bank_account',
  'debit_card',
  'credit_card',
  'prepaid_card',
  'wallet',
  'bnpl',
  'other',
]

export function allowsLast4(type: PaymentMethodType): boolean {
  return PAYMENT_TYPE_META[type].allowsLast4
}

/** Theme color for a payment method type (card/chip tint fallback). */
export function defaultColorForPaymentMethodType(type: PaymentMethodType): string {
  return PAYMENT_TYPE_META[type]?.color ?? PAYMENT_TYPE_META.other.color
}

/** Emoji kept for the AI/legacy add path (list display fallback). */
export function defaultIconEmojiForPaymentMethodType(type: PaymentMethodType): string {
  switch (type) {
    case 'cash':
      return '💵'
    case 'bank_account':
      return '🏦'
    case 'debit_card':
    case 'credit_card':
      return '💳'
    case 'prepaid_card':
      return '🎫'
    case 'wallet':
      return '👛'
    case 'bnpl':
      return '🪙'
    default:
      return '💰'
  }
}

/** Compat shim: map the pre-v4 enum strings onto the new 8-type model (handoff §5). */
const LEGACY_TYPE_MAP: Record<string, PaymentMethodType> = {
  bank_transfer: 'bank_account',
  card_debit: 'debit_card',
  card_credit: 'credit_card',
  nol: 'prepaid_card',
}

export function normalizePaymentMethodType(raw: string | null | undefined): PaymentMethodType {
  if (!raw) return 'other'
  if (raw in LEGACY_TYPE_MAP) return LEGACY_TYPE_MAP[raw]
  if (raw in PAYMENT_TYPE_META) return raw as PaymentMethodType
  return 'other'
}

// ── Brand catalogue ─────────────────────────────────────────────────────────
// Picking a brand auto-resolves type, colours and initials (handoff §5).
export interface PaymentBrand {
  id: string
  name: string
  short: string
  type: PaymentMethodType
  colors: [string, string]
  country?: 'EG' | 'SA' | 'AE'
  full?: string
}

const CAT_RAW: Record<
  string,
  { name: string; type: PaymentMethodType; colors: [string, string]; country?: 'EG' | 'SA' | 'AE'; full?: string }
> = {
  instapay: { name: 'InstaPay', type: 'wallet', colors: ['#12A594', '#0C6E63'], country: 'EG' },
  vodafone: { name: 'Vodafone Cash', type: 'wallet', colors: ['#E60000', '#8A1520'], country: 'EG' },
  nbe: { name: 'NBE', full: 'National Bank of Egypt', type: 'bank_account', colors: ['#2E8B57', '#1C5A38'], country: 'EG' },
  cib: { name: 'CIB', full: 'Commercial International Bank', type: 'bank_account', colors: ['#2E5AAC', '#B23A6B'], country: 'EG' },
  meeza: { name: 'Meeza', type: 'prepaid_card', colors: ['#C6A24E', '#7A6428'], country: 'EG' },
  valu: { name: 'valU', type: 'bnpl', colors: ['#F04E23', '#8A2A12'], country: 'EG' },
  fawry: { name: 'Fawry', type: 'wallet', colors: ['#E8A200', '#1B4B8A'], country: 'EG' },
  telda: { name: 'Telda', type: 'wallet', colors: ['#8B7BF0', '#4A3FA0'], country: 'EG' },
  mada: { name: 'mada', type: 'debit_card', colors: ['#5E8B00', '#3A5600'], country: 'SA' },
  stcpay: { name: 'STC Pay', type: 'wallet', colors: ['#4F008C', '#2A0050'], country: 'SA' },
  urpay: { name: 'urpay', type: 'wallet', colors: ['#7A2E8E', '#4A1A56'], country: 'SA' },
  alrajhi: { name: 'Al Rajhi', full: 'Al Rajhi Bank', type: 'bank_account', colors: ['#1E7E34', '#0F4A1E'], country: 'SA' },
  tabby: { name: 'Tabby', type: 'bnpl', colors: ['#1FA98A', '#12705B'], country: 'SA' },
  tamara: { name: 'Tamara', type: 'bnpl', colors: ['#C08A00', '#7A5600'], country: 'SA' },
  enbd: { name: 'Emirates NBD', type: 'bank_account', colors: ['#C8102E', '#7A0A1C'], country: 'AE' },
  adcb: { name: 'ADCB', type: 'bank_account', colors: ['#C4405A', '#7A2838'], country: 'AE' },
  fab: { name: 'FAB', full: 'First Abu Dhabi Bank', type: 'bank_account', colors: ['#0B2C5F', '#3E6BA8'], country: 'AE' },
  careempay: { name: 'Careem Pay', type: 'wallet', colors: ['#2E9E58', '#1F6F3C'], country: 'AE' },
  eand: { name: 'e& money', type: 'wallet', colors: ['#E30613', '#8A0A10'], country: 'AE' },
  nol: { name: 'Nol', type: 'prepaid_card', colors: ['#0E86C0', '#005C82'], country: 'AE' },
  applepay: { name: 'Apple Pay', type: 'wallet', colors: ['#2E2E36', '#5A5A66'] },
  visa: { name: 'Visa card', type: 'credit_card', colors: ['#1A1F71', '#4B4FA0'] },
  mastercard: { name: 'Mastercard', type: 'credit_card', colors: ['#CF1F2E', '#EB621D'] },
  amex: { name: 'Amex', full: 'American Express', type: 'credit_card', colors: ['#2E77BC', '#1A4A7A'] },
  paypal: { name: 'PayPal', type: 'wallet', colors: ['#003087', '#009CDE'] },
  wise: { name: 'Wise', type: 'wallet', colors: ['#37517E', '#163300'] },
}

/** First 2–3 letters of a provider name, uppercased (card/picker chip). */
export function providerInitials(name: string): string {
  const s = (name || '').replace(/[^a-z]/gi, '')
  return (s.slice(0, 3) || '—').toUpperCase()
}

export const PAYMENT_BRANDS: Record<string, PaymentBrand> = Object.fromEntries(
  Object.entries(CAT_RAW).map(([id, b]) => [id, { id, short: providerInitials(b.name), ...b }]),
)

export const QUICK_ADD: Record<'EG' | 'SA' | 'AE', string[]> = {
  EG: ['instapay', 'vodafone', 'nbe', 'cib', 'meeza', 'valu', 'fawry', 'telda'],
  SA: ['mada', 'stcpay', 'urpay', 'alrajhi', 'tabby', 'tamara', 'applepay'],
  AE: ['enbd', 'adcb', 'fab', 'careempay', 'eand', 'nol', 'applepay'],
}

/** Blended cross-country popular set (when the user has no country). */
export const QUICK_ADD_BLEND: string[] = [
  'instapay', 'mada', 'enbd', 'vodafone', 'stcpay', 'cib', 'careempay', 'tabby', 'nbe', 'valu',
]

/** Card-colour slider swatches (handoff §3.2). */
export const CARD_COLORS: string[] = [
  '#2E5AAC', '#3B82F6', '#0E86C0', '#0EA5E9', '#12A594', '#1FA98A', '#2E8B57', '#5E8B00',
  '#84BD00', '#C6A24E', '#E8A200', '#F59E0B', '#F04E23', '#E60000', '#CF1F2E', '#B23A6B',
  '#EC4899', '#D946A6', '#8B7BF0', '#7C3AED', '#5B3FA0', '#4F008C', '#3A4256', '#5A5A66', '#22232E',
]

// ── Name composition (strict / auto — handoff §6) ────────────────────────────
export function composePaymentMethodName(
  provider: string,
  opts: { last4?: string; tag?: string } = {},
): string {
  const p = provider.trim()
  if (opts.last4) return `${p} ••••${opts.last4}`
  if (opts.tag && opts.tag.trim()) return `${p} · ${opts.tag.trim()}`
  return p
}

/** Reverse of {@link composePaymentMethodName} for prefilling the edit form. */
export function decomposePaymentMethodName(
  name: string,
  last4?: string,
): { provider: string; tag: string } {
  if (last4) {
    const suffix = ` ••••${last4}`
    if (name.endsWith(suffix)) return { provider: name.slice(0, -suffix.length), tag: '' }
    return { provider: name, tag: '' }
  }
  const sep = name.indexOf(' · ')
  if (sep !== -1) return { provider: name.slice(0, sep), tag: name.slice(sep + 3) }
  return { provider: name, tag: '' }
}
