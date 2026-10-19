const NUM = new Intl.NumberFormat('en-US')
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const num = (n: number | null | undefined): string => (n == null ? '—' : NUM.format(n))
export const compact = (n: number | null | undefined): string => (n == null ? '—' : COMPACT.format(n))

export function pct(part: number, whole: number, digits = 0): string {
  if (!whole) return '—'
  return `${((part / whole) * 100).toFixed(digits)}%`
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never'
  const s = Math.round((now - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  let label = `${s}s`
  for (const [size, suffix] of [[1, 's'], [60, 'm'], [3600, 'h'], [86400, 'd'], [2592000, 'mo'], [31536000, 'y']] as Array<[number, string]>) {
    if (s >= size) {
      label = `${Math.floor(s / size)}${suffix}`
    }
  }
  return `${label} ago`
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function money(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
}
