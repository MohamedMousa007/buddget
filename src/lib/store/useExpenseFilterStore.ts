import { create } from 'zustand'
import type { ExpenseRange, RangePreset } from '@/lib/expenses/dateRange'

export const AMOUNT_MIN = 0
export const AMOUNT_MAX = 10000

const DEFAULT_RANGE: ExpenseRange = { preset: 'month', from: null, to: null }

/**
 * Expenses screen filter dimensions (session-only — not persisted).
 * Empty `cats`/`methods` arrays mean "all". Active-filter count = number of
 * non-empty dimensions (category, payment, amount-range).
 *
 * `range` lives HERE and never in `useSettingsStore.monthFilter`, which is global,
 * persisted, and read by ~19 files (dashboard, income, widget, notifications, AI).
 * Picking "Today" on Expenses must not silently repaint all of them. The `month`
 * preset resolves *from* `monthFilter`, so the two stay coherent without coupling.
 */
interface ExpenseFilterState {
  cats: string[]
  methods: string[]
  amtMin: number
  amtMax: number
  range: ExpenseRange
  toggleCat: (id: string) => void
  toggleMethod: (id: string) => void
  setAmtMin: (v: number) => void
  setAmtMax: (v: number) => void
  setRangePreset: (preset: RangePreset) => void
  setCustomRange: (from: string | null, to: string | null) => void
  /** Drops selected categories that no longer exist in the visible range. */
  pruneCats: (available: string[]) => void
  reset: () => void
}

export const useExpenseFilterStore = create<ExpenseFilterState>((set) => ({
  cats: [],
  methods: [],
  amtMin: AMOUNT_MIN,
  amtMax: AMOUNT_MAX,
  range: DEFAULT_RANGE,
  toggleCat: (id) =>
    set((s) => ({ cats: s.cats.includes(id) ? s.cats.filter((x) => x !== id) : [...s.cats, id] })),
  toggleMethod: (id) =>
    set((s) => ({ methods: s.methods.includes(id) ? s.methods.filter((x) => x !== id) : [...s.methods, id] })),
  setAmtMin: (v) => set((s) => ({ amtMin: Math.min(v, s.amtMax) })),
  setAmtMax: (v) => set((s) => ({ amtMax: Math.max(v, s.amtMin) })),
  setRangePreset: (preset) => set((s) => ({ range: { ...s.range, preset } })),
  setCustomRange: (from, to) => set({ range: { preset: 'custom', from, to } }),
  pruneCats: (available) =>
    set((s) => {
      const next = s.cats.filter((c) => available.includes(c))
      // Same-length means same contents (filter preserves order) — skip the write so
      // this can be called from an effect without looping.
      return next.length === s.cats.length ? s : { cats: next }
    }),
  reset: () => set({ cats: [], methods: [], amtMin: AMOUNT_MIN, amtMax: AMOUNT_MAX, range: DEFAULT_RANGE }),
}))

/** True when the amount range is narrower than the full span. */
export function amountIsFiltered(amtMin: number, amtMax: number): boolean {
  return amtMin !== AMOUNT_MIN || amtMax !== AMOUNT_MAX
}
