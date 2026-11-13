import { create } from 'zustand'

/**
 * How many held bank messages wait on the user. The held-messages host (mounted once in the shell) owns the fetch and
 * publishes the number here, so the Flow row and the Inbox read it without each fetching the same rows again.
 */
interface PendingSmsState {
  held: number
  setHeld: (held: number) => void
}

export const usePendingSmsStore = create<PendingSmsState>((set) => ({
  held: 0,
  setHeld: (held) => set((s) => (s.held === held ? s : { held })),
}))
