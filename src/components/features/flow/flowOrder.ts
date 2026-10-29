/** Newest day first; inside a day, newest instant first. Array.sort is stable, so full ties keep insertion order. */
export function compareFlowItems(a: { date: string; at: number }, b: { date: string; at: number }): number {
  return b.date.localeCompare(a.date) || b.at - a.at
}

/** Sort key (epoch ms) for a row; a row with only a day sorts at local noon, the fallback every reader of `occurredAt` uses. */
export function instantOf(occurredAt: string | undefined, day: string): number {
  const at = Date.parse(occurredAt ?? '')
  return Number.isNaN(at) ? Date.parse(`${day}T12:00:00`) : at
}
