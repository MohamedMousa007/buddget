import { describe, expect, it } from 'vitest'
import { parseModelJsonToAIResponse } from './gemini'

describe('parseModelJsonToAIResponse validation', () => {
  it('parses a multi-action reply and applies defaults', () => {
    const r = parseModelJsonToAIResponse(JSON.stringify({ actions: [{ action: 'add_expense', data: { amount: 5 } }, { action: 'bogus' }], message: 'Done' }))
    expect(r.actions.map((a) => a.action)).toEqual(['add_expense', 'query'])
    expect(r.actions[1].data).toEqual({})
    expect(r.confidence).toBe(1)
    expect(r.clarificationNeeded).toBeNull()
    expect(r.message).toBe('Done')
  })

  it('coerces confidence and accepts the legacy single action shape', () => {
    const r = parseModelJsonToAIResponse('{"action":"add_expense","data":{"a":1},"confidence":"0.5","message":"ok"}')
    expect(r.confidence).toBe(0.5)
    expect(r.actions[0]).toEqual({ action: 'add_expense', data: { a: 1 } })
  })

  it.each([
    '[1,2]',
    '{"actions":"x"}',
    '{"actions":[{"data":{}}]}',
    '{"data":[]}',
    '{"confidence":"abc"}',
    '{"message":5}',
    '{"clarificationNeeded":3}',
    '{"mood":1}',
  ])('falls back to a safe query for invalid shape %s', (json) => {
    const r = parseModelJsonToAIResponse(json)
    expect(r.actions).toEqual([{ action: 'query', data: {} }])
  })
})
