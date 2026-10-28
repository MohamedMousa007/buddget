import type { ZakatConfig } from '@/lib/store/types'

/** Paying zakat stamps the payment and starts the next lunar year from that day (the year anchor wins in deriveHawl). */
export function markZakatPaid(cfg: ZakatConfig, todayIso: string, nowIso: string): ZakatConfig {
  return { ...cfg, lastPaidDate: nowIso, yearStartDate: todayIso }
}

export function undoZakatPaid(current: ZakatConfig, before: ZakatConfig): ZakatConfig {
  return { ...current, lastPaidDate: before.lastPaidDate, yearStartDate: before.yearStartDate ?? null }
}
