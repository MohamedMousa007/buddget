import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import type { Notice, UsageEvent } from '@/lib/usage/usageNotices'

interface Signals {
  /** The person has asked the Advisor (or its free answer was used): the day-3 nudge is skipped. */
  advisorUsed: boolean
  receiptScanned: boolean
  firstLimitSeen: boolean
  /** The last limit that blocked them, so a later open can say it is back. */
  lastLimit: { scope: 'session' | 'week'; resetAt: string } | null
}

interface UsageStore {
  signals: Signals
  /** Things that just happened, waiting for the presenter (held while money is being entered). */
  events: UsageEvent[]
  /** Notices already shown this app session (a sheet shows once per notice per session). */
  shown: string[]
  /** The Sparks pack picker is open (from a limit sheet or the Usage page). */
  packsOpen: boolean
  setPacksOpen: (open: boolean) => void
  /** The limit sheet being shown, if any (one at a time). */
  sheet: Notice | null
  setSheet: (n: Notice | null) => void
  /** Right after a first purchase (`new`) or a restore (`back`): the Pro page shows its welcome once. */
  welcome: 'new' | 'back' | null
  setWelcome: (w: 'new' | 'back' | null) => void
  push: (e: UsageEvent) => void
  take: () => UsageEvent | undefined
  markShown: (id: string) => void
  setSignal: <K extends keyof Signals>(k: K, v: Signals[K]) => void
}

const EMPTY: Signals = { advisorUsed: false, receiptScanned: false, firstLimitSeen: false, lastLimit: null }

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      signals: EMPTY,
      events: [],
      shown: [],
      packsOpen: false,
      sheet: null,
      setSheet: (sheet) => set({ sheet }),
      setPacksOpen: (open) => set({ packsOpen: open }),
      welcome: null,
      setWelcome: (welcome) => set({ welcome }),
      push: (e) => set((s) => ({ events: [...s.events, e] })),
      take: () => {
        const [first, ...rest] = get().events
        if (first) set({ events: rest })
        return first
      },
      markShown: (id) => set((s) => (s.shown.includes(id) ? s : { shown: [...s.shown, id] })),
      setSignal: (k, v) => set((s) => ({ signals: { ...s.signals, [k]: v } })),
    }),
    {
      name: 'buddget-usage-signals',
      storage: createJSONStorage(() => createSafeLocalStorage()),
      partialize: (s) => ({ signals: s.signals }),
    },
  ),
)

/** Modals in which money is being entered; a notice waits until they close. */
export const MONEY_ENTRY_MODALS: ReadonlySet<string> = new Set(['quickAdd', 'editExpense', 'editIncome', 'editIncomeEvent', 'voiceExpense', 'scanReceipt', 'amountReceived', 'assignIncome', 'addCreditCard'])
