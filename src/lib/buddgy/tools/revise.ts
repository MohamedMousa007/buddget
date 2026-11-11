import { TOOLS } from '@/lib/buddgy/tools/exec'
import type { Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import type { ToolContext } from '@/lib/buddgy/tools/types'

/** Re-proposes a card with the user's edit applied; `revising` keeps the card from flagging itself as a duplicate. */
export function reviseProposalArgs(proposal: Proposal, patch: Record<string, string>, ctx: Pick<ToolContext, 'now' | 'locale'>): ProposeResult | undefined {
  return TOOLS.get(proposal.tool)?.write?.propose({ ...proposal.args, ...patch }, { ...ctx, revising: true })
}
