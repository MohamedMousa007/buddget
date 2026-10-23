import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_SKEW_MS = 60_000

export function validSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(raw).digest()
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function freshTimestamp(ts: unknown, now: number): boolean {
  return typeof ts === 'number' && Math.abs(now - ts) <= MAX_SKEW_MS
}

export interface IssueEvent { identifier: string; stateType: string }

/** The one thing we act on: an issue whose workflow state changed. */
export function parseIssueEvent(body: unknown): IssueEvent | null {
  const b = body as { type?: string; action?: string; data?: { identifier?: string; state?: { type?: string } } } | null
  if (b?.type !== 'Issue' || b.action !== 'update') return null
  const identifier = b.data?.identifier
  const stateType = b.data?.state?.type
  return identifier && stateType ? { identifier, stateType } : null
}

/** Linear workflow state type to the ticket status we mirror; anything else changes nothing. */
export function ticketStatusFor(stateType: string): 'resolved' | 'open' | null {
  if (stateType === 'completed') return 'resolved'
  if (stateType === 'started' || stateType === 'unstarted' || stateType === 'backlog' || stateType === 'triage') return 'open'
  return null
}
