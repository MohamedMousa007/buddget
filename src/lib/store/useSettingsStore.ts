import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'

export interface ExpensePrefill {
  date?: string
  description?: string
  amount?: string
  currency?: string
  category?: string
  paymentMethod?: string
  notes?: string
}

export interface PmPrefill {
  name: string
  last4: string
}

/** Persisted resting position of the draggable Buddgy orb. */
export interface BuddgyOrbPosition {
  side: 'left' | 'right'
  top: number
}

interface SettingsState {
  sidebarOpen: boolean
  activeModal: string | null
  editingExpenseId: string | null
  /** Debt being edited in EditDebtSheet (separate from expense edit id). */
  editingDebtId: string | null
  editingIncomeId: string | null
  editingIncomeEventId: string | null
  expensePrefill: ExpensePrefill | null
  pmPrefill: PmPrefill | null
  monthFilter: string
  /** Pre-filled AI chat input (e.g. voice "Open in chat" hands off the transcript). */
  aiChatSeed: string | null
  /** Mute spoken-aloud answers in the voice flow (persisted). */
  voiceSpeakMuted: boolean
  /** When opening add-debt sheet from "Record payment" on a card */
  debtSheetPaymentOnly: boolean
  debtSheetPrefillDebtId: string | null
  /** Draggable Buddgy orb resting position (persisted). */
  buddgyOrb: BuddgyOrbPosition
  setBuddgyOrb: (pos: BuddgyOrbPosition) => void
  setSidebarOpen: (open: boolean) => void
  setActiveModal: (modal: string | null) => void
  setEditingExpenseId: (expenseId: string | null) => void
  setEditingDebtId: (debtId: string | null) => void
  setEditingIncomeId: (incomeId: string | null) => void
  setEditingIncomeEventId: (id: string | null) => void
  setExpensePrefill: (data: ExpensePrefill | null) => void
  openAddExpenseWithPrefill: (data: ExpensePrefill) => void
  openAddPaymentMethodWithPrefill: (data: PmPrefill) => void
  clearPmPrefill: () => void
  setMonthFilter: (month: string) => void
  openAiChatWithSeed: (text: string) => void
  clearAiChatSeed: () => void
  setVoiceSpeakMuted: (muted: boolean) => void
  openDebtSheetNew: () => void
  openPayDebtSheet: () => void
  openDebtSheetRecordPayment: (debtId: string) => void
  resetDebtSheetIntent: () => void
  resetSettings: () => void
  /** Same as `resetSettings` (logout UI state). */
  reset: () => void
}

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      activeModal: null,
      editingExpenseId: null,
      editingDebtId: null,
      editingIncomeId: null,
      editingIncomeEventId: null,
      expensePrefill: null,
      pmPrefill: null,
      monthFilter: getCurrentMonth(),
      aiChatSeed: null,
      voiceSpeakMuted: false,
      debtSheetPaymentOnly: false,
      debtSheetPrefillDebtId: null,
      buddgyOrb: { side: 'right', top: 620 },
      setBuddgyOrb: (pos) => set({ buddgyOrb: pos }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setEditingExpenseId: (expenseId) => set({ editingExpenseId: expenseId }),
      setEditingDebtId: (debtId) => set({ editingDebtId: debtId }),
      setEditingIncomeId: (incomeId) => set({ editingIncomeId: incomeId }),
      setEditingIncomeEventId: (id) => set({ editingIncomeEventId: id }),
      setExpensePrefill: (data) => set({ expensePrefill: data }),
      openAddExpenseWithPrefill: (data) =>
        set({ activeModal: 'addExpense', expensePrefill: data }),
      openAddPaymentMethodWithPrefill: (data) =>
        set({ activeModal: 'addPaymentMethod', pmPrefill: data }),
      clearPmPrefill: () => set({ pmPrefill: null }),
      setMonthFilter: (month) => set({ monthFilter: month }),
      openAiChatWithSeed: (text) => set({ activeModal: 'aiChat', aiChatSeed: text }),
      clearAiChatSeed: () => set({ aiChatSeed: null }),
      setVoiceSpeakMuted: (muted) => set({ voiceSpeakMuted: muted }),
      openDebtSheetNew: () =>
        set({
          debtSheetPaymentOnly: false,
          debtSheetPrefillDebtId: null,
          activeModal: 'addDebt',
        }),
      openPayDebtSheet: () =>
        set({
          debtSheetPaymentOnly: false,
          debtSheetPrefillDebtId: null,
          activeModal: 'payDebt',
        }),
      openDebtSheetRecordPayment: (debtId) =>
        set({
          debtSheetPaymentOnly: true,
          debtSheetPrefillDebtId: debtId,
          activeModal: 'addDebt',
        }),
      resetDebtSheetIntent: () =>
        set({ debtSheetPaymentOnly: false, debtSheetPrefillDebtId: null }),
      resetSettings: () =>
        set({
          sidebarOpen: false,
          activeModal: null,
          editingExpenseId: null,
          editingDebtId: null,
          editingIncomeId: null,
      editingIncomeEventId: null,
          expensePrefill: null,
          pmPrefill: null,
          monthFilter: getCurrentMonth(),
          aiChatSeed: null,
          voiceSpeakMuted: false,
          debtSheetPaymentOnly: false,
          debtSheetPrefillDebtId: null,
        }),

      reset: () => {
        get().resetSettings()
      },
    }),
    {
      name: 'buddget-ui-settings',
      storage: createJSONStorage(() => createSafeLocalStorage()),
      partialize: (state) => ({
        voiceSpeakMuted: state.voiceSpeakMuted,
        buddgyOrb: state.buddgyOrb,
      }),
    }
  )
)
