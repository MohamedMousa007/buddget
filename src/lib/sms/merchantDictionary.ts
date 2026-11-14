/**
 * Merchant identity and category without the AI (docs/launch/S1-sms-audit.md RC-B).
 *
 * Banks hand over a merchant in whatever shape their terminal printed: upper or lower case, cut to nine or ten
 * characters, with a branch welded on, or behind a payment gateway's prefix. This module folds those into one identity
 * and names the category for merchants everyone in Egypt and Saudi Arabia knows, so the common purchases are named and
 * categorised the same way on every parse tier and for every user.
 *
 * Deliberately generic: national brands and plain trade words only, nothing learned from one user's messages.
 */
import type { ExpenseCategory } from '@/lib/store/types'

/** Payment gateways and acquirers that prefix the real merchant ("GEIDEA*SHOP", "PAYMOB-SHOP", "SQ *SHOP"). */
const GATEWAY =
  /^(?:geideae?|paymob|paytabs|payfort|hyperpay|moyasar|kashier|fawrypay|checkout|telr|payzah|tap|sq|pp|paypal|stcpay|urpay)\s*[*\-_:./]+\s*|^geideae?\s*(?=\p{L})/iu

/** The merchant behind a gateway prefix. Returns the input when there is no prefix or nothing would be left. */
export function stripGateway(raw: string): string {
  const out = raw.replace(GATEWAY, '').trim()
  return out.length >= 2 ? out : raw
}

const fold = (s: string): string => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '')

/**
 * One identity per merchant: gateway prefix removed, case and punctuation folded. "CARREFOUR", "carrefour" and
 * "Geidea*Carrefour" are the same key. Null when nothing usable is left.
 */
export function merchantKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = fold(stripGateway(raw.trim()))
  return key.length >= 2 ? key : null
}

interface Entry { name: string; category: ExpenseCategory; keys: string[]; unless?: RegExp }

/** `[category, display name, ...other spellings]`. Keys are folded at load. */
const TABLE: [ExpenseCategory, string, ...string[]][] = [
  // Groceries
  ['Groceries', 'Carrefour'], ['Groceries', 'Kazyon'], ['Groceries', 'BIM'], ['Groceries', 'Gourmet'], ['Groceries', 'Spinneys'],
  ['Groceries', 'Seoudi'], ['Groceries', 'Hyper One', 'hyperone'], ['Groceries', 'Lulu', 'lulu hypermarket'], ['Groceries', 'Panda', 'hyper panda', 'hyperpanda'],
  ['Groceries', 'Othaim', 'alothaim', 'al othaim'], ['Groceries', 'Danube'], ['Groceries', 'Tamimi', 'tamimi markets'], ['Groceries', 'Farm Superstores', 'farm superstore'],
  ['Groceries', 'BinDawood', 'bin dawood'], ['Groceries', 'Nesto'], ['Groceries', 'Breadfast'], ['Groceries', 'Rabbit Mart', 'rabbit'], ['Groceries', 'InstaShop'],
  ['Groceries', 'Nana', 'nana direct'], ['Groceries', 'Oscar', 'oscar grand stores'], ['Groceries', 'Ragab Sons', 'awlad ragab'], ['Groceries', 'Kheir Zaman', 'khair zaman'],
  ['Groceries', 'Fathalla'], ['Groceries', 'Metro Market'], ['Groceries', 'Zahran'], ['Groceries', 'Al Raya', 'alraya'],
  // Food and delivery
  ['Food', 'Talabat'], ['Food', 'Uber Eats'], ['Food', "McDonald's", 'mcdonalds', 'mc donalds'], ['Food', 'KFC'], ['Food', "Hardee's", 'hardees'], ['Food', 'Burger King'],
  ['Food', 'Pizza Hut'], ['Food', "Domino's", 'dominos'], ['Food', "Papa John's", 'papa johns'], ['Food', 'Starbucks'], ['Food', 'Costa Coffee', 'costa'],
  ['Food', 'Cilantro'], ['Food', 'TBS', 'the bakery shop'], ['Food', 'Buffalo Burger'], ['Food', 'Bazooka'], ['Food', 'Cook Door'], ['Food', "Mo'men", 'momen'],
  ['Food', 'GAD'], ['Food', 'Albaik', 'al baik'], ['Food', 'Herfy'], ['Food', 'Kudu'], ['Food', 'Shawarmer'], ['Food', 'Maestro Pizza'],
  ['Food', 'HungerStation', 'hunger station'], ['Food', 'Jahez'], ['Food', 'Mrsool'], ['Food', 'Elmenus'], ['Food', 'The Chefz', 'chefz'], ['Food', 'Keeta'],
  ['Food', "Dunkin'", 'dunkin', 'dunkin donuts'], ['Food', 'Tim Hortons'], ['Food', 'Krispy Kreme'], ['Food', 'Baskin Robbins'], ['Food', 'Barns', 'barns cafe'],
  ['Food', 'Half Million'], ['Food', 'Subway'], ['Food', 'Americana'], ['Food', 'Al Tazaj', 'altazaj'], ['Food', 'Abou El Sid', 'abou el sid'],
  // Transport
  ['Transport', 'Uber'], ['Transport', 'Careem'], ['Transport', 'inDrive', 'indriver'], ['Transport', 'DiDi'], ['Transport', 'Swvl'], ['Transport', 'Bolt'],
  ['Transport', 'Jeeny'], ['Transport', 'Go Bus', 'gobus'], ['Transport', 'SAPTCO'], ['Transport', 'Haramain Railway', 'haramain', 'hhr'], ['Transport', 'SAR Railway', 'saudi railway'],
  // Fuel
  ['Fuel', 'ChillOut', 'chill out'], ['Fuel', 'Wataniya', 'wataniya petroleum'], ['Fuel', 'TotalEnergies', 'total energies', 'total'], ['Fuel', 'Emarat Misr'],
  ['Fuel', 'Shell'], ['Fuel', 'Mobil'], ['Fuel', 'OLA Energy', 'oilibya'], ['Fuel', 'Taqa'], ['Fuel', 'Gastec'], ['Fuel', 'Aldrees', 'al drees'],
  ['Fuel', 'Petromin'], ['Fuel', 'SASCO'], ['Fuel', 'Naft'],
  // Utilities: telecom and household bills
  ['Utilities', 'Vodafone'], ['Utilities', 'Orange'], ['Utilities', 'Etisalat', 'etisalat by e&', 'e& egypt'], ['Utilities', 'Telecom Egypt', 'te data', 'tedata'],
  ['Utilities', 'WE', 'we fbb', 'we fbb pre', 'we fv', 'we fv post', 'we home', 'we data', 'we internet'], ['Utilities', 'stc', 'saudi telecom'], ['Utilities', 'Mobily'], ['Utilities', 'Zain'], ['Utilities', 'Salam', 'salam mobile'],
  ['Utilities', 'Virgin Mobile'], ['Utilities', 'Lebara'], ['Utilities', 'Saudi Electricity', 'saudi electricity company'], ['Utilities', 'National Water', 'national water company'],
  ['Utilities', 'Home Internet'],
  // Shopping
  ['Shopping', 'Amazon', 'amazon.eg', 'amazon.sa', 'amzn'], ['Shopping', 'noon', 'noon.com'], ['Subscription', 'noon One'], ['Shopping', 'Jumia'], ['Shopping', 'SHEIN'], ['Shopping', 'Temu'],
  ['Shopping', 'Namshi'], ['Shopping', 'IKEA'], ['Shopping', 'Jarir', 'jarir bookstore'], ['Shopping', 'eXtra', 'extra stores'], ['Shopping', 'Zara'],
  ['Shopping', 'H&M', 'h and m'], ['Shopping', 'LC Waikiki', 'lcwaikiki'], ['Shopping', 'Centrepoint', 'centerpoint'], ['Shopping', 'Home Centre', 'home center'],
  ['Shopping', 'B.TECH', 'btech'], ['Shopping', 'Raya Shop'], ['Shopping', '2B'], ['Shopping', 'DeFacto'], ['Shopping', 'Decathlon'], ['Shopping', 'SACO'],
  ['Shopping', 'AliExpress'], ['Shopping', 'Trendyol'], ['Shopping', 'Tradeline'],
  // Health
  ['Health', 'El Ezaby Pharmacy', 'el ezaby', 'elezaby'], ['Health', 'Seif Pharmacies', 'seif pharmacy'], ['Health', 'Misr Pharmacies', 'misr pharmacy'],
  ['Health', 'Nahdi', 'al nahdi', 'alnahdi'], ['Health', 'Al Dawaa', 'aldawaa'], ['Health', 'Whites', 'whites pharmacy'], ['Health', 'Vezeeta'],
  // Enjoyment
  ['Enjoyment', 'VOX Cinemas', 'vox'], ['Enjoyment', 'Muvi Cinemas', 'muvi'], ['Enjoyment', 'AMC Cinemas'], ['Enjoyment', 'PUBG Mobile', 'pubgmobile', 'pubg'],
  ['Enjoyment', 'PlayStation', 'playstation network'], ['Enjoyment', 'Steam', 'steam games', 'steampowered'], ['Enjoyment', 'Tazkarti'], ['Enjoyment', 'webook'],
  // Rent and education
  ['Rent', 'Ejar'], ['Education', 'Udemy'], ['Education', 'Coursera'],
]

/** A telecom name followed by "cash" is that operator's wallet, which is a transfer, never a bill. */
const WALLET_SUFFIX = /\bcash\b|كاش|\bpay\b|\bbank\b/i

const ENTRIES: Entry[] = TABLE.map(([category, name, ...aliases]) => ({
  name,
  category,
  keys: [...new Set([name, ...aliases].map(fold))].filter((k) => k.length >= 2),
  ...(category === 'Utilities' ? { unless: WALLET_SUFFIX } : {}),
}))

/** Trade words that name the category when the brand is unknown. Whole words only, on the gateway-stripped name. */
const TRADE_WORDS: [RegExp, ExpenseCategory][] = [
  [/\bpharmac(?:y|ies|ie)\b|\bpharma\b|صيدلي[ةه]|صيدليات/i, 'Health'],
  [/\b(?:super|hyper|mini)?\s?markets?\b|\bgrocer(?:y|ies)\b|\btamwinat\b|\btmwyna(?:t)?\b|\baswa?q\b|تموينات|[أا]سواق|بقال[ةه]|سوبر\s?ماركت/i, 'Groceries'],
  [/\brestaurants?\b|\bcafe\b|\bcaffe\b|\bcoffee\b|\bbakery\b|\bpizza\b|\bburger\b|\bgrill\b|\bkitchen\b|\bshaw[ae]rma\b|\bshawaya\b|\bmata?e?am\b|مطعم|مطاعم|مخبز|كافيه|شاورما/i, 'Food'],
  [/\b(?:petrol|fuel|gas)\s+station\b|محطة\s+(?:وقود|بنزين)/i, 'Fuel'],
  [/\bcinemas?\b|سينما/i, 'Enjoyment'],
  [/\bschool\b|\buniversity\b|\bacademy\b|مدرسة|جامعة/i, 'Education'],
  [/\bhospital\b|\bclinics?\b|\bdental\b|مستشفى|عيادة/i, 'Health'],
]

/** Shortest cut-off name that may be completed to a longer dictionary key. Banks cut at nine or ten characters. */
const MIN_TRUNCATED = 5
/** Shortest brand that may be recognised as the leading words of a longer name; shorter ones must be the whole name. */
const MIN_LEADING_KEY = 3
/** Most leading words tried as a brand ("burger king maadi" -> "burger king"). */
const MAX_BRAND_WORDS = 3

export interface KnownMerchant { name: string | null; category: ExpenseCategory }

/**
 * The merchant's canonical name and category, or null when nothing here knows it. In order: the exact name; a brand of
 * two or three leading words ("Burger King Maadi"); a trade word ("... PHARMACY"), which names the category but not the
 * merchant and outranks a brand-like first word ("Orange Tree Cafe" is a cafe); a one-word leading brand ("BIM 6 Oct",
 * "Carrefour Banha"); then a cut-off name that completes to exactly one brand ("CARREFO").
 */
export function resolveKnownMerchant(raw: string | null | undefined): KnownMerchant | null {
  if (!raw) return null
  const text = stripGateway(raw.trim())
  const key = fold(text)
  if (key.length < 2) return null
  const usable = ENTRIES.filter((e) => !e.unless?.test(text))
  const named = (e: Entry | undefined): KnownMerchant | null => (e ? { name: e.name, category: e.category } : null)

  const exact = named(usable.find((e) => e.keys.includes(key)))
  if (exact) return exact

  const words = text.split(/[^\p{L}]+/u).filter(Boolean).map(fold)
  const leading = (n: number): KnownMerchant | null => {
    const lead = words.slice(0, n).join('')
    return n <= words.length && lead.length >= MIN_LEADING_KEY ? named(usable.find((e) => e.keys.includes(lead))) : null
  }
  // A brand of two or three words is specific enough to outrank a trade word inside it ("Burger King").
  for (let n = MAX_BRAND_WORDS; n >= 2; n--) {
    const hit = leading(n)
    if (hit) return hit
  }

  const trade = TRADE_WORDS.find(([re]) => re.test(text))
  if (trade) return { name: null, category: trade[1] }

  const first = leading(1)
  if (first) return first

  if (key.length >= MIN_TRUNCATED) {
    const completions = usable.filter((e) => e.keys.some((k) => k.length > key.length && k.startsWith(key)))
    if (completions.length === 1) return named(completions[0])
  }
  return null
}

/** Company-form words a bank's cut-off leaves standing alone ("ESTABLISH", "COMPANY S"): many different shops share them. */
const COMPANY_FORMS = ['establishment', 'company', 'corporation', 'trading', 'enterprise', 'enterprises', 'foundation', 'مؤسسة', 'شركة']

/**
 * True when the name is only a (possibly cut-off) company-form word, so it identifies no particular merchant. Such a
 * name must never be remembered or matched against earlier purchases: one "Establish" is not the next one.
 */
export function isGenericMerchant(raw: string | null | undefined): boolean {
  if (!raw) return false
  // Trailing one-letter fragments are what is left of the real name after the cut.
  const words = stripGateway(raw.trim()).split(/\s+/).filter(Boolean)
  while (words.length > 1 && [...words[words.length - 1]].length === 1) words.pop()
  const key = fold(words.join(''))
  return key.length >= 4 && COMPANY_FORMS.some((w) => w.startsWith(key))
}

/**
 * A telecom or utility bill a bank reports as a deduction of "service value" plus "stamp tax" (Egyptian operators,
 * Arabic or English). The parser types it as a fee because no merchant is named; it is a Utilities bill.
 */
const SERVICE_BILL = /قيمة\s+خدم[ةه][\s\S]{0,40}ضريب[ةه]\s+دمغ[ةه]|service\s+value[\s\S]{0,40}stamp\s+(?:tax|duty)/i

export function isServiceBill(body: string | null | undefined): boolean {
  return !!body && SERVICE_BILL.test(body)
}
