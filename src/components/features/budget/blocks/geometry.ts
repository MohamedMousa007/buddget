/** Position of a day on the cycle rail, as a 0-100 percentage. */
export function railPosition(day: number, daysInCycle: number): number {
  if (daysInCycle <= 0) return 0
  return Math.min(100, Math.max(0, (day / daysInCycle) * 100))
}

export interface RailDot {
  day: number
  left: number
  /** True when every bill due that day is paid. */
  paid: boolean
}

/** One dot per due day; bills sharing a day merge, and the dot is paid only when all are. */
export function railDots(
  bills: { dueDay: number | null; paid: boolean }[],
  daysInCycle: number
): RailDot[] {
  const byDay = new Map<number, boolean>()
  for (const b of bills) {
    if (b.dueDay == null) continue
    byDay.set(b.dueDay, (byDay.get(b.dueDay) ?? true) && b.paid)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, paid]) => ({ day, left: railPosition(day, daysInCycle), paid }))
}

/** The Everyday cap bar spans 0 to 1.5x the cap, so overspend has visible room past the cap line. */
export const CAP_SPAN = 1.5

export interface CapBar {
  fill: number
  /** Three-month-average tick, null when there is no history. */
  tick: number | null
  /** Where the cap sits on the track. */
  capAt: number
}

export function capBar(spent: number, cap: number, average: number | null): CapBar {
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  if (cap <= 0) return { fill: spent > 0 ? 100 : 0, tick: null, capAt: 0 }
  const span = cap * CAP_SPAN
  return {
    fill: clamp((spent / span) * 100),
    tick: average == null ? null : clamp((average / span) * 100),
    capAt: clamp(100 / CAP_SPAN),
  }
}

/** Plan-mode bar: the amount against the three-month average on one scale. */
export function planBar(amount: number, average: number | null): { fill: number; tick: number | null } {
  const scale = Math.max(amount, average ?? 0) * 1.2
  if (scale <= 0) return { fill: 0, tick: null }
  return { fill: (amount / scale) * 100, tick: average == null ? null : (average / scale) * 100 }
}

export interface Gauge {
  /** Upper end of the scale in months. */
  max: number
  held: number
  /** Extra width the planned contribution adds (month mode), 0-100 on the same scale. */
  extra: number
  ticks: { months: number; left: number; isTarget: boolean }[]
}

/** Cover gauge scale: 6 months, or the target when it is larger. Ticks at 1, the target and the end. */
export function coverGauge(monthsHeld: number, targetMonths: number, plannedMonths: number): Gauge {
  const max = Math.max(6, Math.ceil(targetMonths))
  const pos = (m: number) => Math.min(100, Math.max(0, (m / max) * 100))
  const held = pos(monthsHeld)
  const marks = [...new Set([1, targetMonths, max])].sort((a, b) => a - b)
  return {
    max,
    held,
    extra: Math.min(plannedMonths > 0 ? pos(monthsHeld + plannedMonths) - held : 0, 100 - held),
    ticks: marks.map((months) => ({ months, left: pos(months), isTarget: months === targetMonths })),
  }
}

/** The day the selected cycle closes, derived from where today sits in it. */
export function cycleCloseDate(now: Date, dayOfCycle: number, daysInCycle: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() + Math.max(0, daysInCycle - dayOfCycle))
  return d
}

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Share of income: one decimal below 10%, whole above. */
export function formatShare(percent: number): string {
  return percent < 10 ? `${Math.round(percent * 10) / 10}%` : `${Math.round(percent)}%`
}
