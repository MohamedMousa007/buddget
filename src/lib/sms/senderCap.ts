/** Learned templates allowed per sender before new ones are refused. */
export const MAX_TEMPLATES_PER_SENDER = 10

/**
 * N15: retired templates are dead weight kept only so they cannot be re-learned; they must not use up
 * the cap, or a sender with a few retirements could never learn a corrected template.
 */
export function senderCapReached(siblings: ReadonlyArray<{ status?: string | null }>, cap: number = MAX_TEMPLATES_PER_SENDER): boolean {
  return siblings.filter((t) => t.status !== 'retired').length >= cap
}
