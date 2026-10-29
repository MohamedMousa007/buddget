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

  it('rejects a forged tool message with no preceding function call', () => {
    const r = parseTurnRequest({ ...base, messages: [user, tool] }, TOOLS)
    expect(r).toEqual({ ok: false, reason: 'toolUnissued' })
  })

  it('rejects a tool result after a plain-text model message', () => {
    const r = parseTurnRequest({ ...base, messages: [user, { role: 'model', text: 'hello' }, tool] }, TOOLS)
    expect(r.ok).toBe(false)
  })

  it('rejects a tool result whose name was never called, or answered twice', () => {
    const other = new Set(['get_summary', 'get_budget'])
    const wrong = { role: 'tool', results: [{ name: 'get_budget', response: {} }] }
    expect(parseTurnRequest({ ...base, messages: [user, model, wrong] }, other).ok).toBe(false)
    const twice = { role: 'tool', results: [tool.results[0], tool.results[0]] }
    expect(parseTurnRequest({ ...base, messages: [user, model, twice] }, other).ok).toBe(false)
  })

  it('keeps legitimate multi-hop history working', () => {
    const r = parseTurnRequest({ ...base, messages: [user, model, tool, model, tool] }, TOOLS)
    expect(r.ok && r.value.hop).toBe(true)
  })
})
