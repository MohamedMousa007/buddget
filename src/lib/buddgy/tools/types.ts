import type { ApplyResult, Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import type { ToolSpec } from '@/lib/buddgy/tools/spec'

/** What an executor may read. Built per call from the live stores; never cached across turns. */
export interface ToolContext {
  now: Date
  locale: 'en' | 'ar'
}

export type ReadImpl = (args: Record<string, unknown>, ctx: ToolContext) => unknown

export interface WriteImpl {
  /** Validate against live state and describe the change. Must not mutate anything. */
  propose: (args: Record<string, unknown>, ctx: ToolContext) => ProposeResult
  /** Re-validate against live state, mutate through the store's own actions, return the inverse. */
  apply: (proposal: Proposal, ctx: ToolContext) => ApplyResult
}

export interface ToolEntry {
  spec: ToolSpec
  read?: ReadImpl
  write?: WriteImpl
  /** Navigation tools act immediately and have no preview. */
  nav?: (args: Record<string, unknown>, ctx: ToolContext) => { ok: boolean; message: string }
}
