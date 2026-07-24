/**
 * Pure display logic for the SMS template table.
 *
 * Extracted from the component so it can be tested directly: the admin panel sits behind a
 * Supabase session AND a PIN, so the rendered table is awkward to reach in an automated check,
 * while these rules (which tier/health a row shows, how failures are expressed, what each
 * filter includes) are exactly the parts worth pinning down.
 */
import type { SmsTemplateRow } from '@/types/admin'

export interface Chip {
  label: string
  cls: string
  title?: string
}

/** Reach: who a template applies to. */
export const TIER_CHIP: Record<string, Chip> = {
  curated_db: { label: 'Curated DB', cls: 'border-teal-500/30 bg-teal-500/10 text-teal-400' },
  template: { label: 'Template', cls: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
}

/** Health: whether a template is trusted, on probation, or gone. */
export const STATUS_CHIP: Record<string, Chip> = {
  active: {
    label: 'Active',
    cls: 'border-green-500/30 bg-green-500/10 text-green-400',
    title: 'Parsing normally',
  },
  quarantined: {
    label: 'Quarantined',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    title: 'Shadow mode — result unused while AI decides whether to exonerate or retire it',
  },
  retired: {
    label: 'Retired',
    cls: 'border-red-500/30 bg-red-500/10 text-[var(--color-brand-red)]',
    title: 'Never matched again; a replacement is learned from the correction',
  },
  exported: {
    label: 'In code',
    cls: 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]',
    title: 'Now lives in the code patterns; the DB row is kept for history',
  },
}

const UNKNOWN: Chip = {
  label: '—',
  cls: 'border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)]',
}

/** Never blank a cell on an unrecognised value — show the raw value so it is debuggable. */
export function tierChip(tier: string): Chip {
  return TIER_CHIP[tier] ?? { ...UNKNOWN, label: tier || UNKNOWN.label }
}

export function statusChip(status: string): Chip {
  return STATUS_CHIP[status] ?? { ...UNKNOWN, label: status || UNKNOWN.label }
}

export type TemplateFilter = 'all' | 'curated_db' | 'template' | 'unhealthy'

/**
 * Failures as a SHARE of the matches this template actually served.
 *
 * Never an absolute count: a template with 1000 matches and 3 failures is not the same as one
 * with 5 matches and 3, and showing the raw number would imply otherwise. Null when it has
 * served nothing, since a rate over zero matches is meaningless rather than zero.
 */
export function failureRate(tpl: Pick<SmsTemplateRow, 'match_count' | 'failure_count'>): number | null {
  if (!tpl.match_count) return null
  return tpl.failure_count / tpl.match_count
}

export function matchesFilter(
  tpl: Pick<SmsTemplateRow, 'tier' | 'status'>,
  filter: TemplateFilter,
): boolean {
  if (filter === 'all') return true
  // "Needs attention" is anything not actively parsing, whatever its reach.
  if (filter === 'unhealthy') return tpl.status !== 'active'
  return tpl.tier === filter
}
