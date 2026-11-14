import type { ServiceClient } from '@/lib/supabase/service'
import type { ExpenseCategory } from '@/lib/store/types'
import { isGenericMerchant } from '@/lib/sms/merchantDictionary'

const likeLiteral = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * A row the server may still categorise: 'Other' with no source. A source of `user_confirmed` or `user_changed` means
 * the user chose, and `ai_suggested` means a guess is already on it. Known limit: a row the user set to 'Other' by hand
 * before `category_source` existed has no source and looks exactly like an uncategorised one.
 */
export function mayServerCategorise(row: { category: string | null; category_source: string | null }): boolean {
  return row.category === 'Other' && row.category_source == null
}

/**
 * Applies the AI's category to one new purchase and to this user's earlier uncategorised rows at the same merchant.
 * Both writes carry the predicate in the filter, not in a read beforehand: the AI call takes seconds, and the user may
 * have chosen a category in that time. The answer is a suggestion until the user confirms or changes it.
 */
export async function applyAiCategory(
  service: ServiceClient,
  i: { userId: string; expenseId: string; merchant: string; category: ExpenseCategory },
): Promise<void> {
  const suggestion = { category: i.category, category_source: 'ai_suggested' as const }
  await service.from('expenses').update(suggestion).eq('id', i.expenseId).eq('category', 'Other').is('category_source', null)
  // One merchant, one category: earlier uncategorised purchases at the same merchant follow (never for a bare
  // company-form word, which is many merchants).
  if (isGenericMerchant(i.merchant)) return
  await service.from('expenses').update(suggestion)
    .eq('user_id', i.userId).eq('category', 'Other').is('category_source', null).ilike('description', likeLiteral(i.merchant))
    .not('sms_log_id', 'is', null).is('deleted_at', null).is('refunded_at', null)
}
