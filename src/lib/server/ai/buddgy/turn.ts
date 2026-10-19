import type { TurnEvent, TurnRequest, WireMessage, WireToolCall } from '@/lib/buddgy/protocol'
import { EMPTY_USAGE, usageFromGemini, type TokenUsage } from '@/lib/server/ai/units'

interface GeminiContent {
  role: 'user' | 'model'
  parts: unknown[]
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The per-turn block rides on the turn's first user message so the cached prefix stays free of it. */
function withNow(text: string, req: TurnRequest): string {
  const earlier = req.carry ? `[EARLIER]\n${req.carry}\n` : ''
  return `[NOW]\n${req.context}\n${earlier}[USER]\n${text}`
}

export function buildContents(req: TurnRequest): GeminiContent[] {
  let turnStart = -1
  req.messages.forEach((m, i) => {
    if (m.role === 'user') turnStart = i
  })
  return req.messages.map((m: WireMessage, i): GeminiContent => {
    if (m.role === 'user') return { role: 'user', parts: [{ text: i === turnStart ? withNow(m.text, req) : m.text }] }
    if (m.role === 'model') return { role: 'model', parts: m.parts ?? [{ text: m.text ?? '' }] }
    return {
      role: 'user',
      parts: m.results.map((r) => ({
        functionResponse: { name: r.name, response: isRecord(r.response) ? r.response : { result: r.response } },
      })),
    }
  })
}

export interface TurnOutcome {
  usage: TokenUsage
  finish: string
  status: 'ok' | 'error' | 'aborted'
}

const encoder = new TextEncoder()
const frame = (e: TurnEvent) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`)

/** Re-emits Gemini's SSE as Buddgy `TurnEvent`s, accumulating the raw parts a tool hop must echo back. */
export function turnEventStream(
  upstream: ReadableStream<Uint8Array>,
  head: TurnEvent,
  onFinish: (outcome: TurnOutcome) => void | Promise<void>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const reader = upstream.getReader()
  let settled = false
  // Shared with cancel(): an aborted request still settles whatever Gemini had reported.
  let usage = EMPTY_USAGE
  const settle = async (o: TurnOutcome) => {
    if (settled) return
    settled = true
    await onFinish(o)
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(frame(head))
      let buffer = ''
      let finish = 'STOP'
      let blocked = false
      let sawText = false
      const parts: unknown[] = []
      const calls: WireToolCall[] = []

      const handle = (payload: unknown) => {
        if (!isRecord(payload)) return
        if (isRecord(payload.promptFeedback) && payload.promptFeedback.blockReason) blocked = true
        if (isRecord(payload.usageMetadata)) {
          const u = usageFromGemini(payload.usageMetadata)
          if (u.promptTokens > 0 || u.outputTokens > 0) usage = u
        }
        const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null
        if (!isRecord(candidate)) return
        if (typeof candidate.finishReason === 'string') finish = candidate.finishReason
        const content = candidate.content
        if (!isRecord(content) || !Array.isArray(content.parts)) return
        for (const part of content.parts) {
          if (!isRecord(part) || part.thought === true) continue
          if (typeof part.text === 'string' && part.text.length > 0) {
            sawText = true
            controller.enqueue(frame({ t: 'text', d: part.text }))
            const last = parts[parts.length - 1]
            if (isRecord(last) && typeof last.text === 'string' && !part.thoughtSignature && !last.thoughtSignature) last.text += part.text
            else parts.push({ text: part.text, ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}) })
          } else if (isRecord(part.functionCall) && typeof part.functionCall.name === 'string') {
            const args = isRecord(part.functionCall.args) ? part.functionCall.args : {}
            calls.push({ name: part.functionCall.name, args })
            parts.push({ functionCall: { name: part.functionCall.name, args }, ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}) })
          }
        }
      }

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            try {
              handle(JSON.parse(line.slice(5).trim()))
            } catch {
              // a partial or non-JSON frame carries nothing we need
            }
          }
        }
        if (buffer.startsWith('data:')) {
          try {
            handle(JSON.parse(buffer.slice(5).trim()))
          } catch {
            // trailing partial frame
          }
        }
        if (calls.length > 0) {
          controller.enqueue(frame({ t: 'calls', parts, calls }))
        } else if (!sawText) {
          controller.enqueue(frame({ t: 'error', code: blocked || finish === 'SAFETY' ? 'blocked' : 'empty' }))
          await settle({ usage, finish, status: 'error' })
          controller.close()
          return
        }
        controller.enqueue(frame({ t: 'done', units: 0, finish, truncated: finish === 'MAX_TOKENS' }))
        await settle({ usage, finish, status: 'ok' })
        controller.close()
      } catch {
        try {
          controller.enqueue(frame({ t: 'error', code: 'upstream' }))
          controller.close()
        } catch {
          // client already went away
        }
        await settle({ usage, finish, status: 'aborted' })
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined)
      void settle({ usage, finish: 'ABORTED', status: 'aborted' })
    },
  })
}
