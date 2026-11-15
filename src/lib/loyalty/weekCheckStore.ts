import { create } from 'zustand'
import { fetchWeekSummary, type WeekSummary } from '@/lib/loyalty/loyaltyApi'

interface WeekCheckStore {
  summary: WeekSummary | null
  open: boolean
  load: () => Promise<void>
  openSheet: () => void
  closeSheet: () => void
  reset: () => void
}

/** The weekly check's figures and whether its sheet is open. Loaded only while billing is on (BillingHost). */
export const useWeekCheckStore = create<WeekCheckStore>((set) => ({
  summary: null,
  open: false,
  load: async () => set({ summary: await fetchWeekSummary() }),
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
  reset: () => set({ summary: null, open: false }),
}))
