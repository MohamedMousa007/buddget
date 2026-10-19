import { describe, expect, it } from 'vitest'
import { ALL_SPECS } from '@/lib/buddgy/tools/specs'
import { selectSpecs } from '@/lib/server/ai/buddgy/select'
import type { WireMessage } from '@/lib/buddgy/protocol'

const user = (text: string): WireMessage[] => [{ role: 'user', text }]
const writeDomains = (specs: typeof ALL_SPECS) => new Set(specs.filter((s) => s.kind === 'write').map((s) => s.domain))
const sel = (text: string, context = 'on /') => selectSpecs(ALL_SPECS, { messages: user(text), context })

describe('selectSpecs', () => {
  it('always keeps every read and navigation tool', () => {
    const picked = sel('I paid 200 to Ahmed for the loan')
    for (const s of ALL_SPECS.filter((x) => x.kind !== 'write')) expect(picked).toContain(s)
  })

  it('narrows writes to the domains the message names', () => {
    const d = writeDomains(sel('I owe Ahmed 500 more'))
    expect(d.has('debts')).toBe(true)
    expect(d.has('subscriptions')).toBe(false)
    expect(d.has('goals')).toBe(false)
  })

  it('understands Arabic', () => {
    expect(writeDomains(sel('عندي قسط جديد')).has('debts')).toBe(true)
    expect(writeDomains(sel('غير العملة')).has('settings')).toBe(true)
  })

  it('adds the domain of the screen the user is on', () => {
    expect(writeDomains(sel('add one', 'month: x\non /subscriptions\nhas 1 debts')).has('subscriptions')).toBe(true)
  })

  it('keeps the domains of tools already called in this turn', () => {
    const messages: WireMessage[] = [
      { role: 'user', text: 'ok' },
      { role: 'model', parts: [{ functionCall: { name: 'delete_goal', args: {} } }] },
      { role: 'tool', results: [{ name: 'delete_goal', response: {} }] },
    ]
    expect(writeDomains(selectSpecs(ALL_SPECS, { messages, context: 'on /' })).has('goals')).toBe(true)
  })

  it('sends everything when nothing points anywhere', () => {
    expect(sel('hello there')).toHaveLength(ALL_SPECS.length)
  })

  it('is much smaller for a focused request', () => {
    const focused = JSON.stringify(sel('I owe Ahmed 500 more')).length
    const all = JSON.stringify(ALL_SPECS).length
    expect(focused).toBeLessThan(all * 0.6)
  })
})
