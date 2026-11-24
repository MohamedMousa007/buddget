import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'

/** A recurring savings instalment that was skipped because its account had too little free money. */
export interface SkippedInstalment {
  ruleId: string
  due: string
  pocketName: string
  amount: number
  currency: string
  at: string
}

const KEEP = 20

interface SkippedInstalmentsState {
  skipped: SkippedInstalment[]
  record: (s: SkippedInstalment) => void
}

/** Skipped instalments, newest last, so the inbox can tell the user once per occurrence. Device-local. */
export const useSkippedInstalments = create<SkippedInstalmentsState>()(
  persist(
    (set) => ({
      skipped: [],
      record: (s) =>
        set((st) =>
          st.skipped.some((x) => x.ruleId === s.ruleId && x.due === s.due) ? st : { skipped: [...st.skipped, s].slice(-KEEP) },
        ),
    }),
    { name: 'buddget-skipped-instalments', storage: createJSONStorage(() => createSafeLocalStorage()) },
  ),
)
