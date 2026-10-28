const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function dayInMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

/** The next time pay lands on `day` of the month, counting today; a 31st in a short month falls on its last day. */
export function nextPayday(today: Date, day: number): Date {
  const t = startOfDay(today)
  const thisMonth = dayInMonth(t.getFullYear(), t.getMonth(), day)
  return thisMonth >= t ? thisMonth : dayInMonth(t.getFullYear(), t.getMonth() + 1, day)
}

export interface DailyAllowance {
  payday: Date
  /** Whole days from today to payday; 0 means today is payday. */
  days: number
  /** Balance spread over those days, rounded down; null when there is nothing to spread or no days left. */
  perDay: number | null
}

/** "About X a day until payday": the balance over the days left. Before any bills are known, so it is a first estimate. */
export function dailyAllowance(balance: number, today: Date, paydayDay: number): DailyAllowance {
  const payday = nextPayday(today, paydayDay)
  const days = Math.round((payday.getTime() - startOfDay(today).getTime()) / 86_400_000)
  return { payday, days, perDay: days > 0 && balance > 0 ? Math.floor(balance / days) : null }
}
