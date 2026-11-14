/**
 * Global merchant→category memory (table `merchant_categories`).
 *
 * The curated/template parse tiers extract a merchant but never a category, so their purchases
 * default to 'Other'. This module fills that gap without an AI call in the common case:
 *
 *   1. the subscription catalog already knows the big brands (Netflix, OSN+, Spotify… → their
 *      `defaultCategory`) — free and deterministic;
 *   2. the learned cache, populated by AI parses and user corrections, knows everything a human
 *      or the model has categorised before — "learn once, reach all".
 *
 * Only genuinely-new merchants fall through to the AI categoriser in the parse route, which then
 * writes the answer here so it is never asked twice.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import type { ExpenseCategory } from '@/lib/store/types'
import { resolveBrandKeyFromMerchant, findBrandByKey } from '@/lib/constants/subscriptionCatalog'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { isGenericMerchant, resolveKnownMerchant } from './merchantDictionary'

const VALID_CATEGORIES: ReadonlySet<string> = new Set<ExpenseCategory>([
  'Rent', 'Transport', 'Food', 'Enjoyment', 'Savings', 'Debt', 'Remittance', 'Instapay',
  'Groceries', 'Fuel', 'Health', 'Shopping', 'Education', 'Utilities', 'Subscription', 'Other',
])

function asCategory(v: string | null | undefined): ExpenseCategory | null {
  return v && VALID_CATEGORIES.has(v) && v !== 'Other' && !isNonSpendCategory(v) ? (v as ExpenseCategory) : null
}

/**
 * Lowercased alphanumeric fold — MUST stay identical to the SQL key
 * (`regexp_replace(lower(x),'[^a-z0-9]','','g')`) or reads and writes miss each other.
 * Arabic-only names fold to '' → null: they skip the cache and re-categorise via AI each time.
 * ponytail: Latin merchants only; add transliteration if Arabic merchants prove common.
 */
export function merchantCategoryKey(merchant: string | null | undefined): string | null {
  if (!merchant) return null
  const key = merchant.toLowerCase().replace(/[^a-z0-9]/g, '')
  return key.length >= 3 ? key : null
}

/** Catalog default category for a known subscription brand, if it's a usable (non-Other) one. */
export function catalogCategory(merchant: string | null | undefined): ExpenseCategory | null {
  const brand = findBrandByKey(resolveBrandKeyFromMerchant(merchant ?? null))
  return brand ? asCategory(brand.defaultCategory) : null
}

/** `%`, `_` and `\` are wildcards to ILIKE; a merchant name is matched literally. */
const likeLiteral = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Resolve a merchant to a category, most personal first:
 *   1. this user's own correction (their edits never reach other users until corroborated);
 *   2. the Egypt / Saudi dictionary and the subscription catalog, which are deterministic and ahead of any AI answer;
 *   3. what this user's earlier purchases at the same merchant were filed under, so one merchant has one category;
 *   4. the shared learned cache.
 * Returns null when nothing knows it yet: the caller keeps the parser's category (or 'Other') and the route may
 * AI-categorise in the background.
 */
export async function resolveMerchantCategory(
  service: ServiceClient,
  merchant: string | null | undefined,
  userId?: string,
): Promise<ExpenseCategory | null> {
  // A bare company-form word ("Establish") is many merchants: nothing learned about one applies to the next.
  if (isGenericMerchant(merchant)) return null
  const key = merchantCategoryKey(merchant)
  if (userId && key) {
    const { data: own } = await service
      .from('merchant_category_overrides')
      .select('category')
      .eq('user_id', userId)
      .eq('merchant_key', key)
      .maybeSingle()
    const mine = asCategory(own?.category as string | undefined)
    if (mine) return mine
  }

  const known = asCategory(resolveKnownMerchant(merchant)?.category) ?? catalogCategory(merchant)
  if (known) return known

  if (userId && merchant?.trim()) {
    const { data: earlier } = await service
      .from('expenses')
      .select('category')
      .eq('user_id', userId)
      .ilike('description', likeLiteral(merchant.trim()))
      .not('sms_log_id', 'is', null)
      .neq('category', 'Other')
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    const before = asCategory(earlier?.category as string | undefined)
    if (before) return before
  }

  if (!key) return null
  const { data } = await service
    .from('merchant_categories')
    .select('category')
    .eq('merchant_key', key)
    .maybeSingle()
  return asCategory(data?.category as string | undefined)
}

/**
 * Persist merchant→category knowledge. `source` orders trust: 'user' (a correction) outranks
 * 'ai'/'seed' and is never silently overwritten by them — the RPC enforces that. Best-effort:
 * a cache-write failure must never fail the transaction that produced the category.
 */
export async function rememberMerchantCategory(
  service: ServiceClient,
  merchant: string | null | undefined,
  category: ExpenseCategory,
  source: 'ai' | 'user' | 'seed',
): Promise<void> {
  const key = merchantCategoryKey(merchant)
  if (!key || category === 'Other' || isNonSpendCategory(category) || isGenericMerchant(merchant)) return
  try {
    await service.rpc('upsert_merchant_category', {
      p_key: key, p_category: category, p_source: source, p_sample: (merchant ?? '').slice(0, 120),
    })
  } catch (e) {
    console.warn('[sms/merchantCategoryCache] remember failed', e)
  }
}
