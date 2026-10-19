import type { PreviewModel, Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import type { ToolRisk } from '@/lib/buddgy/tools/spec'
import { formatCurrency } from '@/lib/utils/formatters'

/** Shared building blocks for write tools, so every domain proposes and fails the same way. */

export function makeProposal(args: {
  tool: string
  args: Record<string, unknown>
  risk: ToolRisk
  preview: PreviewModel
  /** What the model is told came of its call. Say "pending", never "done". */
  summary: string
}): Proposal {
  return {
    id: crypto.randomUUID(),
    tool: args.tool,
    args: args.args,
    risk: args.risk,
    createdAt: Date.now(),
    preview: args.preview,
    summary: args.summary,
  }
}

export const ok = (proposal: Proposal): ProposeResult => ({ ok: true, proposal })

export const fail = (error: string, hint?: string, choices?: { id: string; label: string }[]): ProposeResult => ({
  ok: false,
  error,
  ...(hint ? { hint } : {}),
  ...(choices ? { choices } : {}),
})

export const money = (amount: number, currency: string): string => formatCurrency(amount, currency, !Number.isInteger(amount))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date in yyyy-MM-dd, or null. Rejects 2026-02-31 style dates the regex alone would pass. */
export function parseIsoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v
}

export const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

export const text = (v: unknown, max = 120): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim().replace(/\s+/g, ' ')
  return t === '' ? undefined : t.slice(0, max)
}
