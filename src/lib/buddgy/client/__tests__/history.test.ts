import { describe, expect, it } from 'vitest'
import type { BuddgyItem, ChatItem } from '@/lib/buddgy/client/chatTypes'
import { compressHistory, VERBATIM_ITEMS } from '@/lib/buddgy/client/history'
import { relevantMemories } from '@/lib/buddgy/client/context'
import type { BuddgyMemory } from '@/lib/store/types'

const user = (i: number, text = `question ${i}`): ChatItem => ({ id: `u${i}`, role: 'user', text })
const bot = (i: number, over: Partial<BuddgyItem> = {}): ChatItem => ({
  id: `b${i}`,
  role: 'buddgy',
  text: `answer ${i}`,
  proposals: [],
  reads: [],
  status: 'done',
  ...over,
})

describe('compressHistory', () => {
  it('keeps a short chat word for word with no carry', () => {
    const { messages, carry } = compressHistory([user(1), bot(1), user(2)])
    expect(messages).toEqual([
      { role: 'user', text: 'question 1' },
      { role: 'model', text: 'answer 1' },
      { role: 'user', text: 'question 2' },
    ])
    expect(carry).toBeUndefined()
  })

  it('folds older turns into short lines and keeps the last window verbatim', () => {
    const items: ChatItem[] = []
    for (let i = 1; i <= 8; i++) items.push(user(i), bot(i))
    const { messages, carry } = compressHistory(items)
    expect(messages.length).toBeLessThanOrEqual(VERBATIM_ITEMS)
    expect(messages[0].role).toBe('user')
    expect(carry).toContain('asked: question 1')
    expect(carry).not.toContain('question 8')
  })

  it('records what became of a proposal', () => {
    const proposal = { id: 'p', tool: 'add_expense', args: {}, risk: 'approve', createdAt: 0, summary: '', preview: { domain: 'expenses', tone: 'add', title: 'Add expense', rows: [] } } as never
    const { messages } = compressHistory([user(1), bot(1, { proposals: [{ proposal, status: 'applied' }] })])
    expect(messages[1]).toMatchObject({ role: 'model', text: expect.stringContaining('done: Add expense') })
  })

  it('drops a streaming reply and never starts with a model turn', () => {
    const { messages } = compressHistory([bot(0), user(1), bot(1, { status: 'streaming' })])
    expect(messages).toEqual([{ role: 'user', text: 'question 1' }])
  })

  it('caps the carry', () => {
    const items: ChatItem[] = []
    for (let i = 1; i <= 80; i++) items.push(user(i, 'x'.repeat(200)), bot(i, { text: 'y'.repeat(200) }))
    expect(compressHistory(items).carry!.length).toBeLessThanOrEqual(1000)
  })
})

describe('relevantMemories', () => {
  const mem = (text: string, updatedAt: string): BuddgyMemory => ({ id: text, text, kind: 'fact', source: 'chat', status: 'active', createdAt: updatedAt, updatedAt })

  it('returns everything when there are few', () => {
    expect(relevantMemories([mem('a b c', '1'), mem('d e f', '2')], 'anything')).toHaveLength(2)
  })

  it('prefers facts that share words with the question and skips proposed ones', () => {
    const many = [
      ...Array.from({ length: 6 }, (_, i) => mem(`unrelated fact number ${i}`, `2026-01-0${i + 1}`)),
      mem('saves for a wedding in june', '2026-01-01'),
      { ...mem('wedding budget secret', '2026-01-09'), status: 'proposed' as const },
    ]
    const out = relevantMemories(many, 'how is my wedding fund doing')
    expect(out).toHaveLength(5)
    expect(out[0]).toBe('saves for a wedding in june')
    expect(out).not.toContain('wedding budget secret')
  })
})
