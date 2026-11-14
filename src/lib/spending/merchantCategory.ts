import type { Expense } from '@/lib/store/types'

const COMPANY_WORDS = ['establishment', 'company', 'corporation', 'trading', 'enterprise', 'enterprises', 'foundation']

export function merchantKeyOf(description: string): string | null {
  const key = description.toLowerCase().replace(/[^a-z0-9]/g, '')
  return key.length >= 3 ? key : null
}

/** A bank-cut company word ("Establish", "Company S") stands for many shops: never learn or ask about it. */
export function isCompanyFormOnly(description: string): boolean {
  const words = description.trim().split(/\s+/)
  while (words.length > 1 && words[words.length - 1].length === 1) words.pop()
  const folded = words.join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  return folded.length >= 4 && COMPANY_WORDS.some((w) => w.startsWith(folded))
}

const isUncategorisedBankPurchase = (e: Expense): boolean =>
  Boolean(e.smsLogId) && !e.refundKind && e.category === 'Other'

export function sameMerchantUncategorised(
  expenses: readonly Expense[],
  edited: Pick<Expense, 'id' | 'description'>,
): Expense[] {
  const key = merchantKeyOf(edited.description)
  if (key === null || isCompanyFormOnly(edited.description)) return []
  return expenses.filter((e) => e.id !== edited.id && isUncategorisedBankPurchase(e) && merchantKeyOf(e.description) === key)
}

export interface UnknownMerchant {
  key: string
  name: string
  ids: string[]
  total: number
  currency: string
}

export const merchantPromptKey = (key: string): string => `merchantcat:${key}`

export function unknownMerchants(expenses: readonly Expense[], asked: Record<string, string> | undefined): UnknownMerchant[] {
  const groups = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (!isUncategorisedBankPurchase(e) || !(e.amount > 0)) continue
    if (/^(transfer|atm)/i.test(e.description.trim()) || isCompanyFormOnly(e.description)) continue
    const key = merchantKeyOf(e.description)
    if (key === null || asked?.[merchantPromptKey(key)]) continue
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const out: { latest: Expense; item: UnknownMerchant }[] = []
  for (const [key, rows] of groups) {
    if (new Set(rows.map((r) => r.currency)).size !== 1) continue
    const latest = rows.reduce((a, b) => (b.date > a.date ? b : a))
    out.push({
      latest,
      item: { key, name: latest.description, ids: rows.map((r) => r.id), total: rows.reduce((s, r) => s + r.amount, 0), currency: latest.currency },
    })
  }
  out.sort((a, b) => b.item.ids.length - a.item.ids.length || (b.latest.date > a.latest.date ? 1 : b.latest.date < a.latest.date ? -1 : 0))
  return out.map((o) => o.item)
}

/**
 * What a save does to a category that was only the AI's suggestion: keeping it confirms it, picking another changes
 * it. Either way the row stops being a suggestion, and the two outcomes are what the guesses are scored on. A row
 * that was never a suggestion keeps whatever it had.
 */
export function categorySourceAfterSave(
  before: Pick<Expense, 'category' | 'categorySource'>,
  category: string,
): Expense['categorySource'] {
  if (before.categorySource !== 'ai_suggested') return before.categorySource
  return category === before.category ? 'user_confirmed' : 'user_changed'
}

/** The prompt key recorded when the user chose to answer (as opposed to "Not now"), so the answer rate can be counted. */
export const merchantAnsweredKey = (key: string): string => `merchantcatopen:${key}`

/** Out of the unknown-merchant questions shown and closed, how many the user chose to answer. */
export function merchantAnswerRate(asked: Record<string, string> | undefined): { asked: number; answered: number } {
  const keys = Object.keys(asked ?? {})
  return { asked: keys.filter((k) => k.startsWith('merchantcat:')).length, answered: keys.filter((k) => k.startsWith('merchantcatopen:')).length }
}
