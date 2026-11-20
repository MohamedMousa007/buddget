import type { BuddgyItem, ChatItem } from '@/lib/buddgy/client/chatTypes'

/** Chats kept on this phone, newest first (BDG-013: Buddgy chats work like ChatGPT and Claude). */
export const MAX_CHATS = 50
/** Items kept per chat; the model only ever gets the last few plus a recap, so this is for reading back. */
export const MAX_ITEMS = 80
const TITLE_MAX = 48

export interface SavedChat {
  id: string
  /** The server's chat id, so a reopened chat continues on the same counters. */
  serverChatId: string | null
  title: string
  createdAt: number
  updatedAt: number
  items: ChatItem[]
  /** A read ran in this chat, so later write proposals still need a tap. */
  tainted: boolean
}

export const isStreaming = (items: readonly ChatItem[]): boolean => items.some((i) => i.role === 'buddgy' && i.status === 'streaming')

/** The first thing the user asked, on one line. No model call, so naming a chat costs nothing. */
export function titleOf(items: readonly ChatItem[]): string {
  const first = items.find((i) => i.role === 'user')?.text.replace(/\s+/g, ' ').trim() ?? ''
  return first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX - 1)}…` : first
}

/** What is written to the phone: the last items, without the Undo callbacks (they cannot survive a restart). */
export function forSaving(items: readonly ChatItem[]): ChatItem[] {
  return items.slice(-MAX_ITEMS).map((i) => (i.role === 'buddgy' ? { ...i, proposals: i.proposals.map((p) => ({ proposal: p.proposal, status: p.status, ...(p.message ? { message: p.message } : {}) })) } : i))
}

/**
 * A chat read back after the app was closed: a change still waiting is out of date and can never be applied (so nothing is
 * written twice), and a reply cut off mid-stream becomes a failed reply the user can retry.
 */
export function restoreItems(items: readonly ChatItem[]): ChatItem[] {
  return items.map((i): ChatItem => {
    if (i.role !== 'buddgy') return i
    const b: BuddgyItem = { ...i, proposals: i.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'stale' as const } : p)) }
    return b.status === 'streaming' ? { ...b, status: 'error', error: { kind: 'failed' } } : b
  })
}

/** Puts a chat first, replacing its older copy, and keeps the newest MAX_CHATS. */
export function upsertChat(chats: readonly SavedChat[], chat: SavedChat): SavedChat[] {
  return [chat, ...chats.filter((c) => c.id !== chat.id)].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS)
}

export type ChatGroupKey = 'today' | 'yesterday' | 'week' | 'older'

const dayStart = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Today / Yesterday / Previous 7 days / Older, by the phone's own calendar day; empty groups are left out. */
export function groupChats(chats: readonly SavedChat[], now: Date): { key: ChatGroupKey; chats: SavedChat[] }[] {
  const today = dayStart(now.getTime())
  const DAY = 86_400_000
  const keyOf = (t: number): ChatGroupKey => {
    const d = dayStart(t)
    if (d >= today) return 'today'
    if (d >= today - DAY) return 'yesterday'
    if (d >= today - 7 * DAY) return 'week'
    return 'older'
  }
  const order: ChatGroupKey[] = ['today', 'yesterday', 'week', 'older']
  return order.map((key) => ({ key, chats: chats.filter((c) => keyOf(c.updatedAt) === key) })).filter((g) => g.chats.length > 0)
}

/** Chats whose title or text contains the query, ignoring case. */
export function searchChats(chats: readonly SavedChat[], query: string): SavedChat[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...chats]
  return chats.filter((c) => c.title.toLowerCase().includes(q) || c.items.some((i) => i.text.toLowerCase().includes(q)))
}
