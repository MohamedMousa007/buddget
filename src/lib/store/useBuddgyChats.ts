'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import { upsertChat, type SavedChat } from '@/lib/buddgy/client/savedChats'

/**
 * Buddgy chats saved on this phone only (BDG-013). Never synced: a transcript can hold amounts the user typed, so it stays
 * on the device and is wiped on sign-out and whenever another account signs in.
 */
interface BuddgyChatsState {
  ownerId: string | null
  activeId: string | null
  chats: SavedChat[]
  /** Makes the store this user's: a different user (or signed out) starts from nothing. */
  claim: (userId: string | null) => void
  save: (chat: SavedChat) => void
  setActive: (id: string | null) => void
  remove: (id: string) => void
  clear: () => void
}

export const useBuddgyChats = create<BuddgyChatsState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      activeId: null,
      chats: [],
      claim: (userId) => {
        if (get().ownerId !== userId) set({ ownerId: userId, activeId: null, chats: [] })
      },
      save: (chat) => set((s) => ({ chats: upsertChat(s.chats, chat), activeId: chat.id })),
      setActive: (id) => set({ activeId: id }),
      remove: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id), activeId: s.activeId === id ? null : s.activeId })),
      clear: () => set({ ownerId: null, activeId: null, chats: [] }),
    }),
    { name: 'buddget-buddgy-chats', storage: createJSONStorage(() => createSafeLocalStorage()) },
  ),
)

export function clearBuddgyChats(): void {
  useBuddgyChats.getState().clear()
}
