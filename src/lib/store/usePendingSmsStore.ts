import { create } from 'zustand'

/**
 * How many held bank messages wait on the user. The held-messages host (mounted once in the shell) owns the fetch and
 * publishes the number here, so the Flow row and the Inbox read it without each fetching the same rows again.
 */
interface PendingSmsState {
  held: number
  /** When the oldest held message arrived (ms), or null. */
  heldSince: number | null
  setHeld: (held: number, since?: number | null) => void
}

export const usePendingSmsStore = create<PendingSmsState>((set) => ({
  held: 0,
  heldSince: null,
  setHeld: (held, since = null) => set((s) => (s.held === held && s.heldSince === since ? s : { held, heldSince: since })),
}))
