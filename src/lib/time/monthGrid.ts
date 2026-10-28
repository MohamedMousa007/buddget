import { weekColumn, type WeekStartDay } from '@/lib/time/weekStart'

export interface GridDay {
  y: number
  m: number
  d: number
  out: boolean
}

/** 42-cell month grid (6 rows) whose first column is `weekStart`, padded with adjacent-month days. */
export function buildMonthGrid(y: number, m: number, weekStart: WeekStartDay): GridDay[] {
  const lead = weekColumn(new Date(y, m, 1).getDay(), weekStart)
  const dim = new Date(y, m + 1, 0).getDate()
  const prevDim = new Date(y, m, 0).getDate()
  const prevM = m === 0 ? 11 : m - 1
  const prevY = m === 0 ? y - 1 : y
  const nextM = m === 11 ? 0 : m + 1
  const nextY = m === 11 ? y + 1 : y
  const cells: GridDay[] = []
  for (let i = lead - 1; i >= 0; i--) cells.push({ d: prevDim - i, y: prevY, m: prevM, out: true })
  for (let d = 1; d <= dim; d++) cells.push({ d, y, m, out: false })
  for (let nd = 1; cells.length < 42; nd++) cells.push({ d: nd, y: nextY, m: nextM, out: true })
  return cells
}

/** JS weekday of each grid column, left to right. */
export function weekdayColumns(weekStart: WeekStartDay): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7)
}

const PICKER_FIRST_YEAR = 1970
const PICKER_YEARS_AHEAD = 50

/** Year choices for the picker: 1970 through 50 years from now (20-year loans, retirement goals). */
export function pickerYears(now: Date = new Date()): number[] {
  const last = now.getFullYear() + PICKER_YEARS_AHEAD
  return Array.from({ length: last - PICKER_FIRST_YEAR + 1 }, (_, i) => PICKER_FIRST_YEAR + i)
}
