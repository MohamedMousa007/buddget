import { beforeEach, describe, expect, it } from 'vitest'
import type { BuddgyItem, ChatItem } from '@/lib/buddgy/client/chatTypes'
import { MAX_CHATS, MAX_ITEMS, forSaving, groupChats, restoreItems, searchChats, titleOf, upsertChat, type SavedChat } from '@/lib/buddgy/client/savedChats'
import { useBuddgyChats } from '@/lib/store/useBuddgyChats'

// BDG-013: Buddgy chats are kept on the phone and reopened like ChatGPT and Claude.
const user = (text: string, id = text): ChatItem => ({ id, role: 'user', text })
const reply = (over: Partial<BuddgyItem> = {}): BuddgyItem => ({ id: 'b', role: 'buddgy', text: 'ok', proposals: [], reads: [], status: 'done', ...over })
const proposal = { id: 'p1', tool: 'add_expense', args: {}, risk: 'approve', createdAt: 0, summary: '', preview: { domain: 'expenses', tone: 'add', title: 'Add', rows: [] } } as never
const chat = (id: string, updatedAt: number, over: Partial<SavedChat> = {}): SavedChat => ({ id, serverChatId: null, title: id, createdAt: updatedAt, updatedAt, items: [], tainted: false, ...over })

describe('titleOf', () => {
  it('is the first user message on one line, trimmed', () => {
    expect(titleOf([user('  How much did I\nspend on food?  ')])).toBe('How much did I spend on food?')
    expect(titleOf([user('x'.repeat(80))])).toHaveLength(48)
    expect(titleOf([])).toBe('')
  })
})

describe('forSaving and restoreItems', () => {
  it('keeps the last items and drops the Undo callbacks', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => user(`m${i}`, `u${i}`))
    expect(forSaving(many)).toHaveLength(MAX_ITEMS)
    const saved = forSaving([reply({ proposals: [{ proposal, status: 'applied', undo: () => undefined }] })])
    expect((saved[0] as BuddgyItem).proposals[0]).not.toHaveProperty('undo')
  })

  it('after a restart a waiting change is out of date and a cut reply can be retried', () => {
    const restored = restoreItems([reply({ proposals: [{ proposal, status: 'pending' }, { proposal, status: 'applied' }] }), reply({ id: 's', status: 'streaming', text: 'half' })])
    const [a, b] = restored as BuddgyItem[]
    expect(a.proposals.map((p) => p.status)).toEqual(['stale', 'applied'])
    expect(b).toMatchObject({ status: 'error', error: { kind: 'failed' } })
  })
})

describe('the list', () => {
  it('puts the latest first, replaces an older copy, and keeps at most MAX_CHATS', () => {
    let list: SavedChat[] = []
    for (let i = 0; i < MAX_CHATS + 3; i++) list = upsertChat(list, chat(`c${i}`, i))
    expect(list).toHaveLength(MAX_CHATS)
    expect(list[0].id).toBe(`c${MAX_CHATS + 2}`)
    list = upsertChat(list, chat('c10', 1_000))
    expect(list[0].id).toBe('c10')
    expect(list.filter((c) => c.id === 'c10')).toHaveLength(1)
  })

  it('groups by the phone’s calendar day', () => {
    const now = new Date(2026, 10, 20, 15, 0)
    const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime()
    const groups = groupChats([chat('a', at(20)), chat('b', at(19, 23)), chat('c', at(15)), chat('d', at(1))], now)
    expect(groups.map((g) => [g.key, g.chats.map((c) => c.id)])).toEqual([['today', ['a']], ['yesterday', ['b']], ['week', ['c']], ['older', ['d']]])
  })

  it('search matches the title or any message, ignoring case', () => {
    const list = [chat('Food', 1, { items: [user('lunch 120')] }), chat('Rent', 2)]
    expect(searchChats(list, 'LUNCH').map((c) => c.id)).toEqual(['Food'])
    expect(searchChats(list, 'rent').map((c) => c.id)).toEqual(['Rent'])
    expect(searchChats(list, '  ')).toHaveLength(2)
  })
})

describe('useBuddgyChats', () => {
  beforeEach(() => useBuddgyChats.getState().clear())

  it('another account signing in starts from nothing', () => {
    const s = useBuddgyChats.getState()
    s.claim('u1')
    s.save(chat('mine', 1))
    useBuddgyChats.getState().claim('u1')
    expect(useBuddgyChats.getState().chats).toHaveLength(1)
    useBuddgyChats.getState().claim('u2')
    expect(useBuddgyChats.getState()).toMatchObject({ ownerId: 'u2', chats: [], activeId: null })
  })

  it('deleting the open chat leaves no chat open', () => {
    const s = useBuddgyChats.getState()
    s.claim('u1')
    s.save(chat('a', 1))
    expect(useBuddgyChats.getState().activeId).toBe('a')
    useBuddgyChats.getState().remove('a')
    expect(useBuddgyChats.getState()).toMatchObject({ chats: [], activeId: null })
  })
})
