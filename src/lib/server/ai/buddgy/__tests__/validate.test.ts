import { describe, expect, it } from 'vitest'
import { parseTurnRequest } from '../validate'

const TOOLS = new Set(['get_summary'])
const base = { context: '{}', locale: 'en' }
const user = { role: 'user', text: 'hi' }
const model = { role: 'model', parts: [{ functionCall: { name: 'get_summary', args: {} } }] }
const tool = { role: 'tool', results: [{ name: 'get_summary', response: {} }] }

describe('parseTurnRequest hop', () => {
  it('ignores a client-sent hop flag on a fresh user turn', () => {
    const r = parseTurnRequest({ ...base, messages: [user], hop: true }, TOOLS)
    expect(r.ok && r.value.hop).toBe(false)
  })

  it('derives hop from a trailing tool message even without the flag', () => {
    const r = parseTurnRequest({ ...base, messages: [user, model, tool] }, TOOLS)
    expect(r.ok && r.value.hop).toBe(true)
  })
})
