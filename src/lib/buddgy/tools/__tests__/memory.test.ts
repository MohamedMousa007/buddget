import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { MEMORY_CAP, useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { BuddgyMemory } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const state = () => useFinanceStore.getState()

const memory = (id: string, text: string, over: Partial<BuddgyMemory> = {}): BuddgyMemory => ({
  id,
  text,
  kind: 'fact',
  source: 'chat',
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
})

const M1 = 'a1a1a1a1-0000-0000-0000-000000000001'
const M2 = 'b2b2b2b2-0000-0000-0000-000000000002'

beforeEach(() => {
  useSettingsStore.setState({ buddgyLearning: true })
  useFinanceStore.setState({ buddgyMemories: [memory(M1, 'Gets paid on the 25th'), memory(M2, 'Prefers short answers', { kind: 'preference' })] })
})

describe('get_memories', () => {
  it('lists active memories with refs', () => {
    useFinanceStore.setState({ buddgyMemories: [...state().buddgyMemories, memory('c3c3c3c3-0', 'Pending idea', { status: 'proposed' })] })
    const res = TOOLS.get('get_memories')?.read?.({}, ctx) as { learning: boolean; memories: unknown[] }
    expect(res.learning).toBe(true)
    expect(res.memories).toEqual([
      { ref: refOf(M1), text: 'Gets paid on the 25th', kind: 'fact' },
      { ref: refOf(M2), text: 'Prefers short answers', kind: 'preference' },
    ])
  })
})

describe('remember', () => {
  it('proposes, saves as a chat memory on apply, and undoes', () => {
    const p = write('remember').propose({ text: '  Saving for   a car ', kind: 'constraint' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('approve')
    expect(state().buddgyMemories).toHaveLength(2)
    const applied = write('remember').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().buddgyMemories.at(-1)).toMatchObject({ text: 'Saving for a car', kind: 'constraint', source: 'chat', status: 'active' })
    if (applied.ok) applied.undo?.()
    expect(state().buddgyMemories).toHaveLength(2)
  })

  it('defaults to a fact and rejects an unknown kind', () => {
    const p = write('remember').propose({ text: 'Has a cat' }, ctx)
    expect(p.ok && p.proposal.args.kind).toBe('fact')
    expect(write('remember').propose({ text: 'x', kind: 'mood' }, ctx).ok).toBe(false)
  })

  it('fails with a clear message when learning is off', () => {
    useSettingsStore.setState({ buddgyLearning: false })
    const r = write('remember').propose({ text: 'Has a cat' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/paused/i)
  })

  it('rejects empty, over-long and duplicate text', () => {
    expect(write('remember').propose({ text: '   ' }, ctx).ok).toBe(false)
    expect(write('remember').propose({ text: 'x'.repeat(281) }, ctx).ok).toBe(false)
    expect(write('remember').propose({ text: 'x'.repeat(280) }, ctx).ok).toBe(true)
    const dup = write('remember').propose({ text: 'gets paid on the 25TH' }, ctx)
    expect(dup.ok).toBe(false)
  })

  it('fails with choices when memory is full', () => {
    useFinanceStore.setState({ buddgyMemories: Array.from({ length: MEMORY_CAP }, (_, i) => memory(`${(i + 16).toString(16).padStart(2, '0')}${'0'.repeat(6)}-0`, `Fact ${i}`)) })
    const r = write('remember').propose({ text: 'One more' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/full/i)
      expect(r.choices?.length).toBe(15)
    }
  })

  it('does not apply once learning was turned off or the memory was added meanwhile', () => {
    const p = write('remember').propose({ text: 'Has a cat' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    useSettingsStore.setState({ buddgyLearning: false })
    expect(write('remember').apply(p.proposal, ctx).ok).toBe(false)
    useSettingsStore.setState({ buddgyLearning: true })
    state().addBuddgyMemory('Has a cat', 'chat')
    expect(write('remember').apply(p.proposal, ctx).ok).toBe(false)
    expect(state().buddgyMemories).toHaveLength(3)
  })
})

describe('forget_memory', () => {
  it('removes the memory and undo adds it back with its kind', () => {
    const p = write('forget_memory').propose({ ref: refOf(M2) }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('approve')
    const applied = write('forget_memory').apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().buddgyMemories.map((m) => m.id)).toEqual([M1])
    if (applied.ok) applied.undo?.()
    expect(state().buddgyMemories.at(-1)).toMatchObject({ text: 'Prefers short answers', kind: 'preference', source: 'chat' })
  })

  it('fails on an unknown ref and on a stale proposal', () => {
    expect(write('forget_memory').propose({ ref: 'zzzzzz' }, ctx).ok).toBe(false)
    const p = write('forget_memory').propose({ ref: refOf(M1) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    state().removeBuddgyMemory(M1)
    expect(write('forget_memory').apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('forget_memory undo', () => {
  it('does nothing when learning was paused after the forget', () => {
    const p = write('forget_memory').propose({ ref: refOf(M1) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = write('forget_memory').apply(p.proposal, ctx)
    useSettingsStore.setState({ buddgyLearning: false })
    if (applied.ok) applied.undo?.()
    expect(state().buddgyMemories.map((m) => m.id)).toEqual([M2])
  })
})
