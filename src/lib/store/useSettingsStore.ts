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

interface SettingsState {
  sidebarOpen: boolean
  activeModal: string | null
  editingExpenseId: string | null
  /** Debt being edited in EditDebtSheet (separate from expense edit id). */
  editingDebtId: string | null
  editingIncomeId: string | null
  expensePrefill: ExpensePrefill | null
  monthFilter: string
  /** When opening add-debt sheet from "Record payment" on a card */
  debtSheetPaymentOnly: boolean
  debtSheetPrefillDebtId: string | null
  setSidebarOpen: (open: boolean) => void
  setActiveModal: (modal: string | null) => void
  setEditingExpenseId: (expenseId: string | null) => void
  setEditingDebtId: (debtId: string | null) => void
  setEditingIncomeId: (incomeId: string | null) => void
  setExpensePrefill: (data: ExpensePrefill | null) => void
  openAddExpenseWithPrefill: (data: ExpensePrefill) => void
  setMonthFilter: (month: string) => void
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
      expensePrefill: null,
      monthFilter: getCurrentMonth(),
      debtSheetPaymentOnly: false,
      debtSheetPrefillDebtId: null,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setEditingExpenseId: (expenseId) => set({ editingExpenseId: expenseId }),
      setEditingDebtId: (debtId) => set({ editingDebtId: debtId }),
      setEditingIncomeId: (incomeId) => set({ editingIncomeId: incomeId }),
      setExpensePrefill: (data) => set({ expensePrefill: data }),
      openAddExpenseWithPrefill: (data) =>
        set({ activeModal: 'addExpense', expensePrefill: data }),
      setMonthFilter: (month) => set({ monthFilter: month }),
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
          expensePrefill: null,
          monthFilter: getCurrentMonth(),
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
      partialize: (state) => ({ monthFilter: state.monthFilter }),
    }
  )
)
