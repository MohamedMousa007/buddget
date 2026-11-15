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
}

export type KeepWeekResult =
  | { status: 'kept'; streak: number; points: number; freezes: number }
  | { status: 'already_kept' | 'too_soon' | 'out_of_window' | 'unconfirmed_items' | 'invalid_week' | 'error' }

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
