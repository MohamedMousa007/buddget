import { isMasked } from '@/lib/privacy/mask'
import { redactBalances } from '@/lib/privacy/redact'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { apiFetchAuth } from '@/lib/apiBase'
import {
  TURN_LIMITS,
  type BuddgyIntent,
  type BuddgyLocale,
  type TurnEvent,
  type TurnRequest,
  type WireMessage,
  type WireToolCall,
  type WireToolResult,
} from '@/lib/buddgy/protocol'
import type { ChatError, ReadNote, TurnOutcome } from '@/lib/buddgy/client/chatTypes'
import { buildContext } from '@/lib/buddgy/client/context'
import { readLabel } from '@/lib/buddgy/client/readLabels'
import { readTurnEvents } from '@/lib/buddgy/client/sse'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { hasNavConsent } from '@/lib/buddgy/tools/navConsent'
import type { Proposal } from '@/lib/buddgy/tools/proposal'
import type { ToolContext } from '@/lib/buddgy/tools/types'

export class TurnFailure extends Error {
  constructor(readonly detail: ChatError) {
    super(detail.kind)
  }
}

export interface RunTurnArgs {
  text: string
  history: WireMessage[]
  carry?: string
  chatId: string | null
  locale: BuddgyLocale
  intent: BuddgyIntent
  route: string
  signal?: AbortSignal
  /** The reply so far. Reset to '' when the model goes back for more data. */
  onText: (textSoFar: string) => void
  /** A read tool is running. */
  onStep?: (label: string) => void
  /** The server-issued chat id, as soon as it is known, so a failed turn still keeps its chat. */
  onChat?: (chatId: string) => void
  now?: Date
}

function toFailure(ev: Extract<TurnEvent, { t: 'error' }>): TurnFailure {
  if (ev.code === 'unauthorized') return new TurnFailure({ kind: 'unauthorized' })
  if (ev.code === 'quota') return new TurnFailure({ kind: 'quota', layer: ev.layer ?? 'unavailable', resetAt: ev.resetAt ?? null })
  if (ev.code === 'blocked') return new TurnFailure({ kind: 'blocked' })
  return new TurnFailure({ kind: 'failed' })
}

async function failureFromResponse(res: Response): Promise<TurnFailure> {
  if (res.status === 401) return new TurnFailure({ kind: 'unauthorized' })
  if (res.status === 429 || res.status === 403 || res.status === 503) {
    const body = (await res.json().catch(() => null)) as { layer?: string; resetAt?: string | null } | null
    if (body?.layer) return new TurnFailure({ kind: 'quota', layer: body.layer, resetAt: body.resetAt ?? null })
  }
  return new TurnFailure({ kind: 'failed' })
}

interface CallsResult {
  results: WireToolResult[]
  proposals: Proposal[]
  reads: ReadNote[]
  /** True when the model has to see the results: a read, or a call that failed. */
  needsModel: boolean
}

/** Keeps one tool result from blowing the request-size cap on the next hop. */
const MAX_RESULT_CHARS = 5000

function clampResult(response: unknown): unknown {
  const json = JSON.stringify(response)
  return json !== undefined && json.length > MAX_RESULT_CHARS ? { truncated: true, partial: json.slice(0, MAX_RESULT_CHARS) } : response
}

export function executeCalls(calls: WireToolCall[], ctx: ToolContext): CallsResult {
  const results: WireToolResult[] = []
  const proposals: Proposal[] = []
  const reads: ReadNote[] = []
  let needsModel = false

  for (const call of calls) {
    const entry = TOOLS.get(call.name)
    if (!entry) {
      results.push({ name: call.name, response: { error: 'unknown_tool' } })
      needsModel = true
      continue
    }
    try {
      if (entry.read) {
        const raw = entry.read(call.args, ctx)
        const hide = isMasked(useFinanceStore.getState().settings.privacy, 'buddgy')
        results.push({ name: call.name, response: clampResult(hide ? redactBalances(raw) : raw) })
        reads.push({ tool: call.name, label: readLabel(call.name, ctx.locale) })
        needsModel = true
      } else if (entry.nav && (hasNavConsent() || !entry.write)) {
        const r = entry.nav(call.args, ctx)
        results.push({ name: call.name, response: r })
        if (!r.ok) needsModel = true
      } else if (entry.write) {
        const r = entry.write.propose(call.args, ctx)
        if (r.ok) {
          proposals.push(r.proposal)
          results.push({ name: call.name, response: { status: 'pending_user_approval', note: r.proposal.summary } })
        } else {
          results.push({ name: call.name, response: { error: r.error, hint: r.hint, choices: r.choices } })
          needsModel = true
        }
      }
    } catch {
      results.push({ name: call.name, response: { error: 'tool_failed' } })
      needsModel = true
    }
  }
  return { results, proposals, reads, needsModel }
}

export async function runTurn(args: RunTurnArgs): Promise<TurnOutcome> {
  const now = args.now ?? new Date()
  const ctx: ToolContext = { now, locale: args.locale }
  const context = buildContext({ now, route: args.route, text: args.text })
  const messages: WireMessage[] = [...args.history, { role: 'user', text: args.text }]

  let chatId = args.chatId
  let rolled = false
  let soft = false
  let truncated = false
  let text = ''
  const proposals: Proposal[] = []
  const reads: ReadNote[] = []

  try {
    for (let hop = 0; hop <= TURN_LIMITS.maxHops; hop++) {
      const body: TurnRequest = {
        ...(chatId ? { chatId } : {}),
        ...(hop > 0 ? { hop: true } : {}),
        messages,
        context,
        carry: args.carry,
        locale: args.locale,
        intent: args.intent,
      }
      let res: Response
      try {
        res = await apiFetchAuth('/api/buddgy/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: args.signal,
        })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        throw new TurnFailure({ kind: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed' })
      }
      if (!res.ok) throw await failureFromResponse(res)

      let calls: WireToolCall[] | null = null
      let parts: unknown[] = []
      let finished = false
      for await (const ev of readTurnEvents(res)) {
        if (ev.t === 'meta') {
          chatId = ev.chatId ?? chatId
          if (ev.chatId) args.onChat?.(ev.chatId)
          rolled ||= ev.rolled
          soft ||= ev.soft
        } else if (ev.t === 'text') {
          text += ev.d
          args.onText(text)
        } else if (ev.t === 'calls') {
          calls = ev.calls
          parts = ev.parts
        } else if (ev.t === 'done') {
          finished = true
          truncated ||= ev.truncated
        } else if (ev.t === 'error') {
          throw toFailure(ev)
        }
      }
      // A stream that ends with neither a result nor a done frame was cut off mid-reply.
      if (!calls && !finished) throw new TurnFailure({ kind: 'failed' })
      if (!calls) break

      const ran = executeCalls(calls, { ...ctx, afterRead: reads.length > 0 })
      proposals.push(...ran.proposals)
      reads.push(...ran.reads)
      if (!ran.needsModel) break
      // The last hop still asking for data means the model never answered: say so instead of a silent empty reply.
      if (hop === TURN_LIMITS.maxHops) {
        if (proposals.length === 0 && !text.trim()) throw new TurnFailure({ kind: 'failed' })
        break
      }

      for (const r of ran.reads) args.onStep?.(r.label)
      // What was streamed before a data lookup was only a lead-in; the answer comes after the data.
      text = ''
      args.onText('')
      messages.push({ role: 'model', parts }, { role: 'tool', results: ran.results })
    }
  } catch (e) {
    // Proposals from earlier hops are real work the user can still approve; a later hop failing must not discard them.
    if (proposals.length === 0 || (e instanceof DOMException && e.name === 'AbortError')) throw e
    truncated = true
  }

  return { text: text.trim(), proposals, reads, chatId, rolled, soft, truncated, intent: args.intent }
}
