import type { ToolDomain, ToolRisk } from '@/lib/buddgy/tools/spec'

/** Everything the chat needs to draw a card for a pending change, with no knowledge of the tool behind it. */

export type FieldKind = 'text' | 'amount' | 'date' | 'select'

export interface EditableField {
  /** Key in the tool's args that this field edits. */
  key: string
  label: string
  kind: FieldKind
  value: string
  /** For `select`. */
  options?: { value: string; label: string }[]
  /** Shown beside an `amount` input. */
  currency?: string
}

export interface PreviewRow {
  label: string
  value: string
  /** Present for edits: the value before the change. */
  before?: string
}

export interface PreviewModel {
  domain: ToolDomain
  tone: 'add' | 'change' | 'danger'
  title: string
  rows: PreviewRow[]
  fields?: EditableField[]
  /** Short effect line, e.g. "Left to spend drops to 1,240". */
  effect?: string
}

export interface Proposal {
  id: string
  tool: string
  args: Record<string, unknown>
  risk: ToolRisk
  createdAt: number
  preview: PreviewModel
  /** True when the model-readable summary already says "pending", so the turn can end without another hop. */
  summary: string
}

export type ProposeResult =
  | { ok: true; proposal: Proposal }
  /** `hint` goes back to the model so it can repair the call or ask the user. */
  | { ok: false; error: string; hint?: string; choices?: { id: string; label: string }[] }

export type ApplyResult =
  | { ok: true; message: string; undo?: () => void }
  | { ok: false; error: string }

/** A proposal older than this is re-validated and may be rejected as stale. */
export const PROPOSAL_TTL_MS = 10 * 60 * 1000
