import { create } from 'zustand'

export const AMOUNT_MIN = 0
export const AMOUNT_MAX = 10000

/**
 * Expenses screen filter dimensions (session-only — not persisted).
 * Empty `cats`/`methods` arrays mean "all". Active-filter count = number of
 * non-empty dimensions (category, payment, amount-range).
 */
interface ExpenseFilterState {
  cats: string[]
  methods: string[]
  amtMin: number
  amtMax: number
  toggleCat: (id: string) => void
  toggleMethod: (id: string) => void
  setAmtMin: (v: number) => void
  setAmtMax: (v: number) => void
  reset: () => void
}

export const useExpenseFilterStore = create<ExpenseFilterState>((set) => ({
  cats: [],
  methods: [],
  amtMin: AMOUNT_MIN,
  amtMax: AMOUNT_MAX,
  toggleCat: (id) =>
    set((s) => ({ cats: s.cats.includes(id) ? s.cats.filter((x) => x !== id) : [...s.cats, id] })),
  toggleMethod: (id) =>
    set((s) => ({ methods: s.methods.includes(id) ? s.methods.filter((x) => x !== id) : [...s.methods, id] })),
  setAmtMin: (v) => set((s) => ({ amtMin: Math.min(v, s.amtMax) })),
  setAmtMax: (v) => set((s) => ({ amtMax: Math.max(v, s.amtMin) })),
  reset: () => set({ cats: [], methods: [], amtMin: AMOUNT_MIN, amtMax: AMOUNT_MAX }),
}))

/** True when the amount range is narrower than the full span. */
export function amountIsFiltered(amtMin: number, amtMax: number): boolean {
  return amtMin !== AMOUNT_MIN || amtMax !== AMOUNT_MAX
}
