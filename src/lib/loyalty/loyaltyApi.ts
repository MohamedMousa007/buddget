import { createClient } from '@/lib/supabase/client'

export interface WeekSummary {
  thisWeek: string
  lastWeek: string
  lastWeekOpen: boolean
  thisWeekKept: boolean
  lastWeekKept: boolean
  unconfirmedThisWeek: number
  unconfirmedLastWeek: number
  streakWeeks: number
  freezesBanked: number
  keptWeeksTotal: number
  /** Records (expenses and income) in each week; a week is kept only with `recordsNeeded` (3). */
  recordsThisWeek: number
  recordsLastWeek: number
  recordsNeeded: number
  multiplier: 1 | 1.5 | 2
}

export type KeepWeekResult =
  | { status: 'kept'; streak: number; points: number; freezes: number; multiplier: 1 | 1.5 | 2; sparksGift: number }
  | { status: 'too_few_records'; records: number; needed: number }
  | { status: 'already_kept' | 'too_soon' | 'out_of_window' | 'unconfirmed_items' | 'invalid_week' | 'error' }

export type ShopResult =
  | { status: 'ok'; balance: number; week: string | null }
  | { status: 'insufficient_points'; balance: number }
  | { status: 'unknown_item' | 'freezes_full' | 'nothing_to_repair' | 'already_owned' | 'error' }

/** Buys a points-shop item (`repair_week`, `streak_freeze`, `card_finish_aurora`, `buddgy_look_midnight`). Spends points, never the tier. */
export async function buyShopItem(item: string): Promise<ShopResult> {
  const { data, error } = await createClient().rpc('loyalty_shop_buy', { p_item: item })
  if (error || !data) return { status: 'error' }
  return data as unknown as ShopResult
}

/** Applies an owned card finish or Buddgy look ('standard' and 'classic' are always owned). */
export async function applyCosmetic(kind: 'card_finish' | 'buddgy_look', key: string): Promise<'ok' | 'not_owned' | 'invalid' | 'error'> {
  const { data, error } = await createClient().rpc('loyalty_apply_cosmetic', { p_kind: kind, p_key: key })
  return error || typeof data !== 'string' ? 'error' : (data as 'ok' | 'not_owned' | 'invalid')
}

export interface CreditRow { number: number; credit_name: string | null }

/** `#023`: the founder number as it is printed on the card and the credits list. */
export const formatFounderNumber = (n: number): string => `#${String(n).padStart(3, '0')}`

/** The week-check sheet's figures, computed by the server in the person's own timezone and week start. Null on any failure. */
export async function fetchWeekSummary(): Promise<WeekSummary | null> {
  const { data, error } = await createClient().rpc('loyalty_week_summary')
  return error || !data ? null : (data as unknown as WeekSummary)
}

/** Keeps one week. The server decides whether it is allowed, counts the day and pays the points; the client only shows the result. */
export async function keepWeek(week: string): Promise<KeepWeekResult> {
  const { data, error } = await createClient().rpc('loyalty_record_week_check', { p_week: week })
  if (error || !data) return { status: 'error' }
  return data as unknown as KeepWeekResult
}

/** Founder numbers with a name only where one was approved. Empty for anyone who is not a founder or beta tester. */
export async function fetchCredits(): Promise<CreditRow[]> {
  const { data, error } = await createClient().rpc('loyalty_credits')
  return error || !data ? [] : (data as CreditRow[])
}

/** An empty name clears the request. The name shows on the list only after an admin approves it. */
export async function requestCreditName(name: string): Promise<'pending' | 'cleared' | 'not_founder' | 'error'> {
  const { data, error } = await createClient().rpc('loyalty_request_credit_name', { p_name: name })
  return error || typeof data !== 'string' ? 'error' : (data as 'pending' | 'cleared' | 'not_founder')
}
