import { TURN_LIMITS, type BuddgyIntent, type BuddgyLocale, type TurnRequest, type WireMessage } from '@/lib/buddgy/protocol'

export type ParseResult = { ok: true; value: TurnRequest } | { ok: false; reason: string }

const INTENTS: readonly BuddgyIntent[] = ['action', 'answer', 'advice']
const LOCALES: readonly BuddgyLocale[] = ['en', 'ar']
const MAX_SIGNATURE = 4000

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Client history is untrusted: only text and well-formed function calls for known tools survive. */
function cleanModelParts(parts: unknown, knownTools: ReadonlySet<string>): unknown[] | null {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > 12) return null
  const out: unknown[] = []
  for (const p of parts) {
    if (!isRecord(p)) return null
    const signature = typeof p.thoughtSignature === 'string' && p.thoughtSignature.length <= MAX_SIGNATURE ? { thoughtSignature: p.thoughtSignature } : {}
    if (typeof p.text === 'string') {
      if (p.text.length > TURN_LIMITS.maxMessageChars) return null
      out.push({ text: p.text, ...signature })
    } else if (isRecord(p.functionCall)) {
      const { name, args } = p.functionCall
      if (typeof name !== 'string' || !knownTools.has(name) || !isRecord(args)) return null
      out.push({ functionCall: { name, args }, ...signature })
    } else {
      return null
    }
  }
  return out
}

export function parseTurnRequest(raw: unknown, knownTools: ReadonlySet<string>): ParseResult {
  if (!isRecord(raw)) return { ok: false, reason: 'body' }
  const { messages, context, carry, locale, intent, chatId } = raw

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > TURN_LIMITS.maxMessages) return { ok: false, reason: 'messages' }
  if (typeof context !== 'string' || context.length > TURN_LIMITS.maxContextChars) return { ok: false, reason: 'context' }
  if (carry !== undefined && (typeof carry !== 'string' || carry.length > TURN_LIMITS.maxCarryChars)) return { ok: false, reason: 'carry' }
  if (typeof locale !== 'string' || !LOCALES.includes(locale as BuddgyLocale)) return { ok: false, reason: 'locale' }
  if (intent !== undefined && !INTENTS.includes(intent as BuddgyIntent)) return { ok: false, reason: 'intent' }
  if (chatId !== undefined && (typeof chatId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId))) return { ok: false, reason: 'chatId' }

  let total = 0
  const clean: WireMessage[] = []
  for (const m of messages) {
    if (!isRecord(m)) return { ok: false, reason: 'message' }
    if (m.role === 'user') {
      if (typeof m.text !== 'string' || m.text.length === 0 || m.text.length > TURN_LIMITS.maxMessageChars) return { ok: false, reason: 'user' }
      total += m.text.length
      clean.push({ role: 'user', text: m.text })
    } else if (m.role === 'model') {
      if (m.parts !== undefined) {
        const parts = cleanModelParts(m.parts, knownTools)
        if (!parts) return { ok: false, reason: 'parts' }
        total += JSON.stringify(parts).length
        clean.push({ role: 'model', parts })
      } else if (typeof m.text === 'string' && m.text.length > 0 && m.text.length <= TURN_LIMITS.maxMessageChars) {
        total += m.text.length
        clean.push({ role: 'model', text: m.text })
      } else {
        return { ok: false, reason: 'model' }
      }
    } else if (m.role === 'tool') {
      if (!Array.isArray(m.results) || m.results.length === 0 || m.results.length > 12) return { ok: false, reason: 'tool' }
      const results: { name: string; response: unknown }[] = []
      for (const r of m.results) {
        if (!isRecord(r) || typeof r.name !== 'string' || !knownTools.has(r.name)) return { ok: false, reason: 'toolResult' }
        results.push({ name: r.name, response: r.response ?? null })
      }
      total += JSON.stringify(results).length
      clean.push({ role: 'tool', results })
    } else {
      return { ok: false, reason: 'role' }
    }
  }
  if (total > TURN_LIMITS.maxTotalChars) return { ok: false, reason: 'size' }
  if (clean[0].role !== 'user') return { ok: false, reason: 'order' }
  if (!clean.some((m) => m.role === 'user')) return { ok: false, reason: 'noUser' }

  return {
    ok: true,
    value: {
      messages: clean,
      context,
      carry: carry as string | undefined,
      locale: locale as BuddgyLocale,
      intent: intent as BuddgyIntent | undefined,
      chatId: chatId as string | undefined,
      hop: clean[clean.length - 1].role === 'tool',
    },
  }
}
