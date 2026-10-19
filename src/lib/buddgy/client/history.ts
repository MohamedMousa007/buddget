import type { WireMessage } from '@/lib/buddgy/protocol'
import type { ChatItem } from '@/lib/buddgy/client/chatTypes'

/** Turns kept word for word. Older turns shrink to one line each. */
export const VERBATIM_ITEMS = 6
/** Once a chat passes its soft budget, only the latest exchange stays word for word. */
const VERBATIM_ITEMS_SOFT = 2
const CARRY_MAX = 1000
/** A past reply is trimmed so one long answer can never push the next request over the server's size cap. */
const MODEL_TEXT_MAX = 2800
const SNIP = 70

const snip = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > SNIP ? `${t.slice(0, SNIP - 1)}…` : t
}

function outcomeNote(item: Extract<ChatItem, { role: 'buddgy' }>): string {
  const notes = item.proposals.map((p) => {
    const what = p.proposal.preview.title
    if (p.status === 'applied') return `done: ${what}`
    if (p.status === 'dismissed') return `declined: ${what}`
    if (p.status === 'pending') return `awaiting approval: ${what}`
    return `not applied: ${what}`
  })
  return notes.length > 0 ? ` [${notes.join('; ')}]` : ''
}

/**
 * Folds a chat into what the model needs next turn, with no model call: the last few turns word
 * for word (with what became of each proposal), everything older as one short line per turn.
 */
export function compressHistory(items: ChatItem[], soft = false): { messages: WireMessage[]; carry: string | undefined } {
  const usable = items.filter((i) => (i.role === 'user' ? i.text.trim() !== '' : i.status !== 'streaming' && (i.text.trim() !== '' || i.proposals.length > 0)))
  const recent = usable.slice(-(soft ? VERBATIM_ITEMS_SOFT : VERBATIM_ITEMS))
  const older = usable.slice(0, usable.length - recent.length)

  const messages: WireMessage[] = []
  for (const item of recent) {
    if (item.role === 'user') {
      messages.push({ role: 'user', text: item.text })
    } else {
      const text = `${item.text.slice(0, MODEL_TEXT_MAX)}${outcomeNote(item)}`.trim().slice(0, 3900)
      if (text) messages.push({ role: 'model', text })
    }
  }
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift()

  const lines = older.map((i) => (i.role === 'user' ? `asked: ${snip(i.text)}` : `${snip(i.text || 'proposed changes')}${outcomeNote(i)}`.replace(/^/, 'replied: ')))
  let carry = lines.join('\n')
  if (carry.length > CARRY_MAX) carry = `…${carry.slice(carry.length - CARRY_MAX + 1)}`
  return { messages, carry: carry || undefined }
}
