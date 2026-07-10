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

// ── Brand catalogue (single source of truth) ─────────────────────────────────
// Picking a brand auto-resolves type, colours and initials (handoff §5). This is
// also the source of truth for provider/SMS-sender → brand resolution (the regex
// layer, via `aliases` + `resolvePaymentBrandKey`). Full Egypt + GCC coverage:
// `country` weights the picker/quick-add (EG/SA/AE first) but every brand stays
// searchable regardless of the user's country.
export type BrandCountry = 'EG' | 'SA' | 'AE' | 'KW' | 'QA' | 'BH' | 'OM' | 'JO'

export interface PaymentBrand {
  id: string
  name: string
  short: string
  type: PaymentMethodType
  colors: [string, string]
  country?: BrandCountry
  full?: string
  /** Extra name variants (EN/AR/bank-SMS-sender) for search + provider matching. */
  aliases?: string[]
}

type CatEntry = {
  name: string
  type: PaymentMethodType
  colors?: [string, string]
  country?: BrandCountry
  full?: string
  aliases?: string[]
}

const CAT_RAW: Record<string, CatEntry> = {
  // ── Egypt ──────────────────────────────────────────────────────────────────
  instapay: { name: 'InstaPay', type: 'wallet', colors: ['#12A594', '#0C6E63'], country: 'EG', aliases: ['instant payment', 'ipn'] },
  vodafone: { name: 'Vodafone Cash', type: 'wallet', colors: ['#E60000', '#8A1520'], country: 'EG', aliases: ['vodafone', 'فودافون كاش'] },
  orangecash: { name: 'Orange Cash', type: 'wallet', colors: ['#FF7900', '#B35500'], country: 'EG', aliases: ['orange money', 'اورنج كاش'] },
  wepay: { name: 'WE Pay', type: 'wallet', country: 'EG', aliases: ['we pay', 'telecom egypt'] },
  etisalatcash: { name: 'e& Cash', type: 'wallet', country: 'EG', aliases: ['etisalat cash', 'e& money egypt'] },
  nbe: { name: 'NBE', full: 'National Bank of Egypt', type: 'bank_account', colors: ['#2E8B57', '#1C5A38'], country: 'EG', aliases: ['al ahly', 'ahly', 'البنك الاهلي'] },
  cib: { name: 'CIB', full: 'Commercial International Bank', type: 'bank_account', colors: ['#2E5AAC', '#B23A6B'], country: 'EG', aliases: ['commercial international bank'] },
  banquemisr: { name: 'Banque Misr', type: 'bank_account', colors: ['#0E7A3B', '#0A4F26'], country: 'EG', aliases: ['بنك مصر', 'bm'] },
  qnbeg: { name: 'QNB Alahli', type: 'bank_account', colors: ['#7A1E2B', '#4A121A'], country: 'EG', aliases: ['qnb egypt', 'qnb alahly'] },
  aaib: { name: 'AAIB', full: 'Arab African International Bank', type: 'bank_account', country: 'EG', aliases: ['arab african'] },
  banqueducaire: { name: 'Banque du Caire', type: 'bank_account', country: 'EG', aliases: ['بنك القاهرة', 'bdc'] },
  aalex: { name: 'Bank of Alexandria', type: 'bank_account', country: 'EG', aliases: ['alexbank', 'بنك الاسكندرية'] },
  faisaleg: { name: 'Faisal Islamic Bank', type: 'bank_account', country: 'EG', aliases: ['faisal bank'] },
  adibeg: { name: 'ADIB Egypt', type: 'bank_account', country: 'EG', aliases: ['abu dhabi islamic bank egypt'] },
  albarakaeg: { name: 'Al Baraka', type: 'bank_account', country: 'EG', aliases: ['al baraka bank egypt'] },
  hsbceg: { name: 'HSBC Egypt', type: 'bank_account', country: 'EG', aliases: ['hsbc'] },
  meeza: { name: 'Meeza', type: 'prepaid_card', colors: ['#C6A24E', '#7A6428'], country: 'EG', aliases: ['ميزة', 'meeza card'] },
  meezadebit: { name: 'Meeza (debit)', type: 'debit_card', colors: ['#C6A24E', '#7A6428'], country: 'EG', aliases: ['meeza debit'] },
  valu: { name: 'valU', type: 'bnpl', colors: ['#F04E23', '#8A2A12'], country: 'EG', aliases: ['value'] },
  sympl: { name: 'Sympl', type: 'bnpl', country: 'EG', aliases: ['simple'] },
  aman: { name: 'Aman', type: 'bnpl', country: 'EG', aliases: ['aman installments'] },
  contact: { name: 'Contact', type: 'bnpl', country: 'EG', aliases: ['contact installments', 'sarwa'] },
  halan: { name: 'MNT-Halan', type: 'wallet', country: 'EG', aliases: ['halan', 'mnt halan'] },
  khazna: { name: 'Khazna', type: 'wallet', country: 'EG', aliases: ['خزنة'] },
  lucky: { name: 'Lucky', type: 'wallet', country: 'EG', aliases: ['lucky one'] },
  opay: { name: 'OPay', type: 'wallet', country: 'EG' },
  fawry: { name: 'Fawry', type: 'wallet', colors: ['#E8A200', '#1B4B8A'], country: 'EG', aliases: ['فوري', 'myfawry'] },
  telda: { name: 'Telda', type: 'wallet', colors: ['#8B7BF0', '#4A3FA0'], country: 'EG', aliases: ['telda card'] },
  // ── Saudi Arabia ─────────────────────────────────────────────────────────────
  mada: { name: 'mada', type: 'debit_card', colors: ['#5E8B00', '#3A5600'], country: 'SA', aliases: ['مدى', 'mada card'] },
  stcpay: { name: 'STC Pay', type: 'wallet', colors: ['#4F008C', '#2A0050'], country: 'SA', aliases: ['stc bank', 'stcpay'] },
  urpay: { name: 'urpay', type: 'wallet', colors: ['#7A2E8E', '#4A1A56'], country: 'SA' },
  barq: { name: 'Barq', type: 'wallet', country: 'SA', aliases: ['barq fintech'] },
  d360: { name: 'D360 Bank', type: 'bank_account', country: 'SA', aliases: ['d360'] },
  alrajhi: { name: 'Al Rajhi', full: 'Al Rajhi Bank', type: 'bank_account', colors: ['#1E7E34', '#0F4A1E'], country: 'SA', aliases: ['rajhi', 'الراجحي'] },
  snb: { name: 'SNB', full: 'Saudi National Bank', type: 'bank_account', country: 'SA', aliases: ['alahli saudi', 'ncb', 'البنك الاهلي السعودي'] },
  riyadbank: { name: 'Riyad Bank', type: 'bank_account', country: 'SA', aliases: ['بنك الرياض'] },
  sabb: { name: 'SABB', full: 'Saudi British Bank', type: 'bank_account', country: 'SA' },
  alinma: { name: 'Alinma Bank', type: 'bank_account', country: 'SA', aliases: ['inma', 'الإنماء'] },
  albilad: { name: 'Bank Albilad', type: 'bank_account', country: 'SA', aliases: ['albilad', 'البلاد'] },
  anb: { name: 'Arab National Bank', type: 'bank_account', country: 'SA', aliases: ['anb'] },
  aljazira: { name: 'Bank Aljazira', type: 'bank_account', country: 'SA', aliases: ['aljazira', 'الجزيرة'] },
  tabby: { name: 'Tabby', type: 'bnpl', colors: ['#1FA98A', '#12705B'], country: 'SA', aliases: ['tabby card'] },
  tamara: { name: 'Tamara', type: 'bnpl', colors: ['#C08A00', '#7A5600'], country: 'SA', aliases: ['تمارا'] },
  // ── United Arab Emirates ─────────────────────────────────────────────────────
  enbd: { name: 'Emirates NBD', type: 'bank_account', colors: ['#C8102E', '#7A0A1C'], country: 'AE', aliases: ['enbd'] },
  adcb: { name: 'ADCB', full: 'Abu Dhabi Commercial Bank', type: 'bank_account', colors: ['#C4405A', '#7A2838'], country: 'AE' },
  fab: { name: 'FAB', full: 'First Abu Dhabi Bank', type: 'bank_account', colors: ['#0B2C5F', '#3E6BA8'], country: 'AE' },
  dib: { name: 'DIB', full: 'Dubai Islamic Bank', type: 'bank_account', country: 'AE', aliases: ['dubai islamic'] },
  mashreq: { name: 'Mashreq', type: 'bank_account', country: 'AE', aliases: ['mashreq neo', 'mashreq bank'] },
  adib: { name: 'ADIB', full: 'Abu Dhabi Islamic Bank', type: 'bank_account', country: 'AE' },
  rakbank: { name: 'RAKBANK', type: 'bank_account', country: 'AE', aliases: ['rak bank'] },
  cbd: { name: 'CBD', full: 'Commercial Bank of Dubai', type: 'bank_account', country: 'AE' },
  liv: { name: 'Liv', type: 'bank_account', country: 'AE', aliases: ['liv bank', 'liv by enbd'] },
  wio: { name: 'Wio', type: 'bank_account', country: 'AE', aliases: ['wio bank'] },
  zand: { name: 'Zand', type: 'bank_account', country: 'AE', aliases: ['zand bank'] },
  careempay: { name: 'Careem Pay', type: 'wallet', colors: ['#2E9E58', '#1F6F3C'], country: 'AE', aliases: ['careem'] },
  eand: { name: 'e& money', type: 'wallet', colors: ['#E30613', '#8A0A10'], country: 'AE', aliases: ['etisalat', 'e and money'] },
  payit: { name: 'Payit', type: 'wallet', country: 'AE', aliases: ['payit fab'] },
  botim: { name: 'Botim Pay', type: 'wallet', country: 'AE', aliases: ['botim', 'payby'] },
  ziina: { name: 'Ziina', type: 'wallet', country: 'AE' },
  nol: { name: 'Nol', type: 'prepaid_card', colors: ['#0E86C0', '#005C82'], country: 'AE', aliases: ['nol card'] },
  hafilat: { name: 'Hafilat', type: 'prepaid_card', country: 'AE', aliases: ['hafilat card'] },
  sayer: { name: 'Sayer', type: 'prepaid_card', country: 'AE', aliases: ['sayer card'] },
  jaywan: { name: 'Jaywan', type: 'debit_card', country: 'AE', aliases: ['jaywan card'] },
  adnoc: { name: 'ADNOC', type: 'prepaid_card', country: 'AE', aliases: ['adnoc rewards', 'adnoc fuel'] },
  enoc: { name: 'ENOC', type: 'prepaid_card', country: 'AE', aliases: ['eppco', 'yes rewards'] },
  emarat: { name: 'Emarat', type: 'prepaid_card', country: 'AE', aliases: ['safeer', 'atheer'] },
  postpay: { name: 'Postpay', type: 'bnpl', country: 'AE' },
  cashew: { name: 'Cashew', type: 'bnpl', country: 'AE', aliases: ['cashew payments'] },
  spotii: { name: 'Spotii', type: 'bnpl', country: 'AE' },
  // ── Kuwait ───────────────────────────────────────────────────────────────────
  knet: { name: 'KNET', type: 'debit_card', country: 'KW', aliases: ['k-net', 'كي نت'] },
  nbk: { name: 'NBK', full: 'National Bank of Kuwait', type: 'bank_account', country: 'KW' },
  kfh: { name: 'KFH', full: 'Kuwait Finance House', type: 'bank_account', country: 'KW', aliases: ['baitk'] },
  boubyan: { name: 'Boubyan Bank', type: 'bank_account', country: 'KW', aliases: ['boubyan', 'nomo'] },
  gulfbank: { name: 'Gulf Bank', type: 'bank_account', country: 'KW' },
  burgan: { name: 'Burgan Bank', type: 'bank_account', country: 'KW' },
  weyay: { name: 'Weyay', type: 'bank_account', country: 'KW', aliases: ['weyay bank'] },
  // ── Qatar ────────────────────────────────────────────────────────────────────
  naps: { name: 'NAPS', type: 'debit_card', country: 'QA', aliases: ['qatar debit'] },
  qnb: { name: 'QNB', full: 'Qatar National Bank', type: 'bank_account', country: 'QA' },
  qib: { name: 'QIB', full: 'Qatar Islamic Bank', type: 'bank_account', country: 'QA' },
  cbq: { name: 'CBQ', full: 'Commercial Bank of Qatar', type: 'bank_account', country: 'QA' },
  dohabank: { name: 'Doha Bank', type: 'bank_account', country: 'QA' },
  ooredoomoney: { name: 'Ooredoo Money', type: 'wallet', country: 'QA', aliases: ['ooredoo'] },
  // ── Bahrain ──────────────────────────────────────────────────────────────────
  benefit: { name: 'BENEFIT', type: 'debit_card', country: 'BH', aliases: ['benefitpay', 'benefit pay'] },
  bbk: { name: 'BBK', full: 'Bank of Bahrain and Kuwait', type: 'bank_account', country: 'BH' },
  nbb: { name: 'NBB', full: 'National Bank of Bahrain', type: 'bank_account', country: 'BH' },
  ilabank: { name: 'ila Bank', type: 'bank_account', country: 'BH', aliases: ['ila'] },
  bisb: { name: 'Bahrain Islamic Bank', type: 'bank_account', country: 'BH', aliases: ['bisb'] },
  // ── Oman ─────────────────────────────────────────────────────────────────────
  omannet: { name: 'OmanNet', type: 'debit_card', country: 'OM' },
  bankmuscat: { name: 'Bank Muscat', type: 'bank_account', country: 'OM' },
  nbo: { name: 'NBO', full: 'National Bank of Oman', type: 'bank_account', country: 'OM' },
  bankdhofar: { name: 'Bank Dhofar', type: 'bank_account', country: 'OM' },
  thawani: { name: 'Thawani', type: 'wallet', country: 'OM', aliases: ['thawani pay'] },
  // ── Global schemes, wallets & rails ──────────────────────────────────────────
  applepay: { name: 'Apple Pay', type: 'wallet', colors: ['#2E2E36', '#5A5A66'], aliases: ['apple wallet'] },
  googlepay: { name: 'Google Pay', type: 'wallet', colors: ['#1A73E8', '#34A853'], aliases: ['gpay', 'google wallet'] },
  samsungpay: { name: 'Samsung Pay', type: 'wallet', colors: ['#1428A0', '#0A1560'], aliases: ['samsung wallet'] },
  visa: { name: 'Visa card', type: 'credit_card', colors: ['#1A1F71', '#4B4FA0'], aliases: ['visa'] },
  mastercard: { name: 'Mastercard', type: 'credit_card', colors: ['#CF1F2E', '#EB621D'], aliases: ['master card', 'mc'] },
  amex: { name: 'Amex', full: 'American Express', type: 'credit_card', colors: ['#2E77BC', '#1A4A7A'], aliases: ['american express'] },
  unionpay: { name: 'UnionPay', type: 'credit_card', aliases: ['china unionpay', 'cup'] },
  paypal: { name: 'PayPal', type: 'wallet', colors: ['#003087', '#009CDE'] },
  payoneer: { name: 'Payoneer', type: 'wallet', colors: ['#FF4800', '#B33300'] },
  wise: { name: 'Wise', type: 'wallet', colors: ['#37517E', '#163300'], aliases: ['transferwise'] },
  skrill: { name: 'Skrill', type: 'wallet' },
  binancepay: { name: 'Binance Pay', type: 'wallet', colors: ['#F0B90B', '#8A6A06'], aliases: ['binance'] },
  edenred: { name: 'Edenred', type: 'prepaid_card', aliases: ['edenred card', 'meal card'] },
  pluxee: { name: 'Pluxee', type: 'prepaid_card', aliases: ['sodexo', 'meal voucher'] },
  zaincash: { name: 'ZainCash', type: 'wallet', country: 'JO', aliases: ['zain cash'] },
}

/** First 2–3 letters of a provider name, uppercased (card/picker chip). */
export function providerInitials(name: string): string {
  const s = (name || '').replace(/[^a-z]/gi, '')
  return (s.slice(0, 3) || '—').toUpperCase()
}

export const PAYMENT_BRANDS: Record<string, PaymentBrand> = Object.fromEntries(
  Object.entries(CAT_RAW).map(([id, b]) => {
    const colors: [string, string] =
      b.colors ?? [PAYMENT_TYPE_META[b.type].color, PAYMENT_TYPE_META[b.type].color]
    return [id, { id, short: providerInitials(b.name), ...b, colors }]
  }),
)

/**
 * Resolves a free-text provider / bank-SMS-sender string to a catalogue brand id,
 * or null. This is the source of truth for provider matching (e.g. prefilling the
 * add-method form from a detected bank name). Exact id/name/alias first, then a
 * length-guarded substring pass. Mirrors `resolveBrandKeyFromMerchant` for subs.
 */
function normalizeBrandToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function resolvePaymentBrandKey(text: string | null | undefined): string | null {
  if (!text) return null
  const norm = normalizeBrandToken(text)
  if (!norm) return null
  const brands = Object.values(PAYMENT_BRANDS)
  // Exact match on id / name / full / any alias.
  for (const b of brands) {
    for (const t of [b.id, b.name, b.full, ...(b.aliases ?? [])]) {
      if (t && normalizeBrandToken(t) === norm) return b.id
    }
  }
  // Length-guarded substring pass (either direction).
  for (const b of brands) {
    for (const t of [b.name, b.full, ...(b.aliases ?? [])]) {
      if (!t) continue
      const tk = normalizeBrandToken(t)
      if (tk.length >= 3 && (norm.includes(tk) || tk.includes(norm))) return b.id
    }
  }
  return null
}

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
