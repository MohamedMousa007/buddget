import type { ToolDomain, ToolRisk } from '@/lib/buddgy/tools/spec'
import type { PaymentMethodType } from '@/lib/store/types'

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
  /** The arg this row shows, so a body that draws that arg its own way (amount hero, a picker) can skip the row. */
  key?: string
}

/** Which of the eight card bodies draws this proposal (docs/quality/buddget-remediation/buddgy-action-cards.md). */
export type ProposalPattern = 'record' | 'batch' | 'create' | 'change' | 'move' | 'remove' | 'status' | 'go'

/** What a create card previews: the thing as the app will show it. */
export type PreviewEntity = 'card' | 'account' | 'debt' | 'plan' | 'subscription' | 'goal' | 'income' | 'holding' | 'memory'

/** One end of a move: the account or pocket, with its balance now and after. */
export interface PreviewRef {
  name: string
  /** Brand colour for its mark, when the app has one. */
  color?: string
  now?: string
  after?: string
}

/** One row of a batch card: a whole proposal of its own, applied with the others. */
export interface BatchItem {
  key: string
  proposal: Proposal
}

export interface PreviewModel {
  domain: ToolDomain
  tone: 'add' | 'change' | 'danger'
  title: string
  rows: PreviewRow[]
  fields?: EditableField[]
  /** Short effect line, e.g. "Left to spend drops to 1,240". */
  effect?: string
  /** Set by the tool when it knows better than the name rule (see `patternOf`). */
  pattern?: ProposalPattern
  /** Record and move: the amount drawn large. */
  amount?: number
  currency?: string
  /** Record: the description under the amount. */
  what?: string
  /** Move: where the money leaves and lands. */
  from?: PreviewRef
  to?: PreviewRef
  /** The payment method the card will use (its ref), the one the pay-with strip rings. */
  methodRef?: string
  /** Create: what kind of thing is being added. */
  entity?: PreviewEntity
  /** Create, for a card or wallet: enough of the method to draw its face. */
  card?: { name: string; type: PaymentMethodType; currency?: string; last4?: string; color?: string }
  /** Keys of `fields` the user has not given; each is asked inside the card. The current value is only a guess. */
  missing?: string[]
  /** Keys of `fields` whose value Buddgy chose; marked "guessed". */
  guessed?: string[]
  /** Batch: the rows, each its own proposal. */
  items?: BatchItem[]
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
