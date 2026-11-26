import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { toISODate } from '@/lib/utils/paydaySchedule'
import type { IncomeEvent, IncomeSource, PaymentMethod } from '@/lib/store/types'
import { paydayState } from './paydaySummary'

/** How many past paydays the hero's check circles show. */
export const HERO_PAYDAYS = 6

export interface PaydayHeroFacts {
  /** The last paydays already due or settled, oldest first (the check circles). */
  last: IncomeOccurrence[]
  /** How many of `last` arrived in full and on time. */
  onTime: number
  /** The next payday still to come (today's open one counts), if any. */
  next?: IncomeOccurrence
}

/** The Paydays hero facts ("Next payday Nov 25 · On time 6 of 6", the month circles) from a run of occurrences. */
export function paydayHeroFacts(occ: readonly IncomeOccurrence[], today: Date, n = HERO_PAYDAYS): PaydayHeroFacts {
  const todayISO = toISODate(today)
  const last = occ.filter((o) => o.eventId || o.dueDate < todayISO).slice(-n)
  const onTime = last.filter((o) => paydayState(o, today).kind === 'received').length
  const next = occ.find((o) => !o.eventId && o.dueDate >= todayISO)
  return { last, onTime, next }
}

/**
 * The account a payday's log sheet starts on: the one the logged payday already landed in, else the payday's own
 * account, else none. Only an account that still exists is returned.
 */
export function paydayLogMethodId(
  saved: Pick<IncomeEvent, 'paymentMethodId'> | undefined,
  source: Pick<IncomeSource, 'paymentMethodId'> | undefined,
  methods: readonly Pick<PaymentMethod, 'id'>[],
): string {
  for (const id of [saved?.paymentMethodId, source?.paymentMethodId]) if (id && methods.some((m) => m.id === id)) return id
  return ''
}

/** A payday with no account learns it from the first payday logged into one, so Edit payday shows it. */
export function adoptedPaydayAccount(source: Pick<IncomeSource, 'paymentMethodId'>, loggedInto: string, methods: readonly Pick<PaymentMethod, 'id'>[]): string | null {
  const own = source.paymentMethodId
  if (own && methods.some((m) => m.id === own)) return null
  return loggedInto && methods.some((m) => m.id === loggedInto) ? loggedInto : null
}
