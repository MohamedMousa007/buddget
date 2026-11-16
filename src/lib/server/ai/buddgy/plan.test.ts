import { describe, expect, it } from 'vitest'
import { CONTEXT_CHARS, hopsDone, resolveAdvisor, trimContext } from './plan'

describe('resolveAdvisor', () => {
  it('only an advice turn is an Advisor turn', () => {
    expect(resolveAdvisor('answer', null)).toEqual({ mode: 'none', intent: 'answer' })
    expect(resolveAdvisor('action', { entitled: false, freeOpen: false }).mode).toBe('none')
  })
  it('Pro keeps the Advisor; Free gets its one answer, then the fast tier', () => {
    expect(resolveAdvisor('advice', { entitled: true, freeOpen: false })).toEqual({ mode: 'pro', intent: 'advice' })
    expect(resolveAdvisor('advice', { entitled: false, freeOpen: true })).toEqual({ mode: 'free', intent: 'advice' })
    expect(resolveAdvisor('advice', { entitled: false, freeOpen: false })).toEqual({ mode: 'locked', intent: 'answer' })
  })
  it('an unreadable gate locks the Advisor rather than spending it', () => {
    expect(resolveAdvisor('advice', null)).toEqual({ mode: 'locked', intent: 'answer' })
  })
})

describe('trimContext', () => {
  it('cuts to 1,500 characters for a quick answer and 3,000 for the Advisor', () => {
    const big = 'x'.repeat(5000)
    expect(trimContext(big, 'answer')).toHaveLength(CONTEXT_CHARS.quick)
    expect(trimContext(big, 'advice')).toHaveLength(CONTEXT_CHARS.advisor)
    expect(trimContext('short', 'answer')).toBe('short')
  })
})

describe('hopsDone', () => {
  it('counts tool results after the last user message only', () => {
    const tool = { role: 'tool' as const, results: [] }
    const model = { role: 'model' as const, text: 'a' }
    expect(hopsDone([{ role: 'user', text: 'q' }])).toBe(0)
    expect(hopsDone([{ role: 'user', text: 'q' }, model, tool, model, tool])).toBe(2)
    expect(hopsDone([{ role: 'user', text: 'q' }, model, tool, { role: 'user', text: 'r' }, model])).toBe(0)
  })
})
