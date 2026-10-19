export interface UsageWindow {
  used: number
  limit: number | null
  reset_at: string | null
}

export interface UsageStatus {
  chat: { units: number; hard: number | null; turns: number; max_turns: number | null } | null
  windows: Partial<Record<'h5' | 'd1' | 'd7', UsageWindow>>
  chats_today: UsageWindow
}

export type UsageRowKey = 'chat' | 'h5' | 'd1' | 'chats'

export interface UsageRow {
  key: UsageRowKey
  /** 0-100, or null when the limit is unlimited. */
  pct: number | null
  resetAt: string | null
}

const pctOf = (used: number, limit: number | null): number | null =>
  limit == null ? null : limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))

/** The rows the wheel's popover lists, and the single figure the wheel itself shows: the tightest limit in play. */
export function summarizeUsage(s: UsageStatus): { rows: UsageRow[]; pct: number } {
  const rows: UsageRow[] = []
  if (s.chat) {
    const byUnits = pctOf(s.chat.units, s.chat.hard)
    const byTurns = pctOf(s.chat.turns, s.chat.max_turns)
    rows.push({ key: 'chat', pct: byUnits == null ? byTurns : byTurns == null ? byUnits : Math.max(byUnits, byTurns), resetAt: null })
  }
  const { h5, d1 } = s.windows
  if (d1) rows.push({ key: 'd1', pct: pctOf(d1.used, d1.limit), resetAt: d1.reset_at })
  if (h5) rows.push({ key: 'h5', pct: pctOf(h5.used, h5.limit), resetAt: h5.reset_at })
  rows.push({ key: 'chats', pct: pctOf(s.chats_today.used, s.chats_today.limit), resetAt: s.chats_today.reset_at })
  return { rows, pct: Math.max(0, ...rows.map((r) => r.pct ?? 0)) }
}
