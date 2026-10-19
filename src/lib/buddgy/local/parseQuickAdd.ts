import { extractAmount } from './quickAddAmount'
import { extractDate } from './quickAddDate'
import { matchCategories } from './lexicon'
import { escapeRe, foldArabic, normalizeText, stripAll, wordRe } from './text'

export interface QuickAddInput {
  baseCurrency: string
  knownCurrencies: string[]
  paymentMethodNames: { ref: string; name: string }[]
  today: string
  locale: 'en' | 'ar'
}

export interface QuickAddParse {
  tool: 'add_expense' | 'add_income'
  args: Record<string, unknown>
  confidence: number
  description: string
}

const MAX_WORDS = 8
const MAX_DESCRIPTION = 60

const NOT_A_PLAIN_ENTRY = wordRe(
  'how|what|when|why|where|which|who|كم|كام|ايه|متى|امتى|ليه|لماذا|ازاي|فين|هل|' +
    'delete|remove|change|update|edit|cancel|undo|احذف|امسح|غير|عدل|الغي|الغاء|شيل',
)

const CURRENCY_WORDS: [string, string][] = [
  ['egp|جنيه|جنيها|جنيهات|ج', 'EGP'],
  ['usd|dollars?|دولار|دولارات', 'USD'],
  ['aed|dirhams?|درهم|دراهم', 'AED'],
  ['sar|ريال|ريالات|riyals?', 'SAR'],
  ['eur|euros?|يورو', 'EUR'],
  ['gbp', 'GBP'],
  ['pounds?', 'POUND'],
]
const UNSUPPORTED_CURRENCY = 'kwd|qar|bhd|omr|tnd|jod|cad|chf|inr|dinars?|دينار|دنانير|rials?'
const SYMBOLS: Record<string, string> = { $: ' usd ', '€': ' eur ', '£': ' gbp ' }

const INCOME_VERB = wordRe('paid me|got|received|earned|استلمت|قبضت')
const INCOME_NOUN = wordRe('salary|income|bonus|wages?|راتب|الراتب|مرتب|دخل')
const EXPENSE_VERB = wordRe('spent|spend|paid|pay|bought|buy|صرفت|دفعت|اشتريت|جبت')
const PREPOSITIONS = 'on|for|in|at|from|to|with|by|using|في|على|ع|ل|ب|من|عن'
const leadingOf = (source: string) =>
  new RegExp(`^(?:${foldArabic(source)})(?![\\p{L}\\d])\\s*`, 'iu')
const LEADING_NOISE = leadingOf(
  `i|we|spent|spend|paid me|paid|pay|bought|buy|got|received|earned|استلمت|قبضت|صرفت|دفعت|اشتريت|جبت|${PREPOSITIONS}`,
)
const TRAILING = new RegExp(`\\s(?:${PREPOSITIONS})$`, 'iu')
const EDGE_PUNCTUATION = /^[\s,،;:!.\-–—_/()"']+|[\s,،;:!.\-–—_/()"']+$/g

function extractCurrency(
  text: string,
  known: string[],
): { currency?: string; rest: string } | null {
  const knownSet = new Set(known.map((c) => c.toUpperCase()))
  const codes = new Set<string>()
  let rest = text
  const words: [string, string][] = [
    [[...knownSet].join('|'), 'KNOWN'],
    ...CURRENCY_WORDS,
    [UNSUPPORTED_CURRENCY, 'UNSUPPORTED'],
  ]
  for (const [source, code] of words) {
    if (!source) continue
    const re = wordRe(source)
    for (const m of rest.matchAll(new RegExp(re.source, 'giu'))) {
      codes.add(code === 'KNOWN' ? m[0].toUpperCase() : code)
    }
    rest = stripAll(rest, re)
  }
  if (codes.delete('POUND')) {
    if (codes.size === 0) {
      const options = ['EGP', 'GBP'].filter((c) => knownSet.has(c))
      if (options.length !== 1) return null
      codes.add(options[0])
    } else if (!(codes.size === 1 && (codes.has('EGP') || codes.has('GBP')))) {
      return null
    }
  }
  if (codes.size > 1) return null
  const [code] = codes
  if (code && !knownSet.has(code)) return null
  return { currency: code, rest }
}

function extractMethod(
  text: string,
  methods: { ref: string; name: string }[],
): { ref?: string; rest: string } {
  const hits = methods
    .filter((m) => m.name.trim())
    .map((m) => {
      const name = escapeRe(m.name.trim())
      const re = new RegExp(`(?<![\\p{L}\\d])(?:(?:with|using|by|on|via|عن طريق)\\s+|بـ|ب\\s?)${name}(?![\\p{L}\\d])`, 'iu')
      return { ...m, re, match: text.match(re) }
    })
    .filter((h) => h.match)
  const longest = hits.filter(
    (h) => !hits.some((o) => o !== h && o.name.length > h.name.length && o.name.toLowerCase().includes(h.name.toLowerCase())),
  )
  if (longest.length !== 1) return { rest: text }
  return { ref: longest[0].ref, rest: stripAll(text, longest[0].re) }
}

function tidy(text: string): string {
  let out = text.replace(/\s+/g, ' ').replace(EDGE_PUNCTUATION, '')
  for (let prev = ''; prev !== out; ) {
    prev = out
    out = out.replace(LEADING_NOISE, '').replace(TRAILING, '').replace(EDGE_PUNCTUATION, '')
  }
  return out.slice(0, MAX_DESCRIPTION).trim()
}

export function parseQuickAdd(text: string, input: QuickAddInput): QuickAddParse | null {
  const clean = normalizeText(text)
  if (!clean || /[?؟]/.test(clean) || NOT_A_PLAIN_ENTRY.test(clean)) return null
  if (clean.split(' ').length > MAX_WORDS) return null

  let rest = ` ${clean.replace(/[$€£]/g, (s) => SYMBOLS[s])} `

  const dated = extractDate(rest, input.today)
  if (!dated) return null
  rest = dated.rest

  const method = extractMethod(rest, input.paymentMethodNames)
  rest = method.rest

  const amount = extractAmount(rest)
  if (!amount) return null
  rest = amount.rest

  const currency = extractCurrency(rest, input.knownCurrencies)
  if (!currency) return null
  rest = currency.rest

  const hasIncomeVerb = INCOME_VERB.test(rest)
  const hasIncomeNoun = INCOME_NOUN.test(rest)
  const categories = matchCategories(rest)
  const common = {
    amount: amount.amount,
    ...(currency.currency && { currency: currency.currency }),
    ...(dated.date && { date: dated.date }),
  }

  if (hasIncomeVerb || hasIncomeNoun) {
    if (categories.length || EXPENSE_VERB.test(rest.replace(/paid me/gi, ' '))) return null
    const name = tidy(stripAll(rest, INCOME_VERB))
    if (!name) return null
    return {
      tool: 'add_income',
      args: { name, ...common, frequency: 'one_time' },
      confidence: hasIncomeNoun ? 0.92 : 0.75,
      description: name,
    }
  }

  const description = tidy(rest)
  if (!description) return null
  const [category] = categories
  const resolved = categories.length === 1 ? category : 'Other'
  const confidence = categories.length === 1 ? 0.92 : categories.length === 0 ? 0.55 : 0.5
  return {
    tool: 'add_expense',
    args: { description, ...common, category: resolved, ...(method.ref && { method: method.ref }) },
    confidence,
    description,
  }
}
