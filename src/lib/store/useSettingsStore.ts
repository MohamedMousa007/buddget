import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import type { PaymentMethodType } from '@/lib/store/types'

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
  /** Bare provider name (no ••last4 suffix) — the sheet composes the display name. */
  name: string
  last4: string
  /** Type implied by the source (e.g. an SMS card transaction); overrides the brand default. */
  type?: PaymentMethodType
}

/** Seed for the add-subscription sheet when a charge was spotted before the user tracked it. */
export interface SubscriptionPrefill {
  brandKey: string
  /** The amount actually charged — better evidence than any catalog price. */
  amount: number
  currency: string
  /** Day of month the charge landed on. */
  billingDay: number
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
  /** Amount-received sheet: the recurring source + payday being marked. */
  markingIncome: { sourceId: string; occKey: string } | null
  /** Assign sheet target: the existing one-time event id being assigned from a row swipe. */
  assignTarget: { eventId: string | null } | null
  expensePrefill: ExpensePrefill | null
  pmPrefill: PmPrefill | null
  /** Seed for the add-subscription sheet; the subscriptions page opens the sheet when set. */
  subscriptionPrefill: SubscriptionPrefill | null
  /**
   * Banner keys the user has dismissed (persisted). Without this a detection banner
   * reappears on every visit to the dashboard, which trains people to ignore it.
   */
  dismissedBanners: string[]
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
  openAmountReceived: (sourceId: string, occKey: string) => void
  openAssignIncome: (target: { eventId: string | null }) => void
  setExpensePrefill: (data: ExpensePrefill | null) => void
  openAddExpenseWithPrefill: (data: ExpensePrefill) => void
  openAddPaymentMethodWithPrefill: (data: PmPrefill) => void
  clearPmPrefill: () => void
  openAddSubscriptionWithPrefill: (data: SubscriptionPrefill) => void
  clearSubscriptionPrefill: () => void
  dismissBanner: (key: string) => void
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
      markingIncome: null,
      assignTarget: null,
      expensePrefill: null,
      pmPrefill: null,
      subscriptionPrefill: null,
      dismissedBanners: [],
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
      openAmountReceived: (sourceId, occKey) =>
        set({ markingIncome: { sourceId, occKey }, activeModal: 'amountReceived' }),
      openAssignIncome: (target) => set({ assignTarget: target, activeModal: 'assignIncome' }),
      setExpensePrefill: (data) => set({ expensePrefill: data }),
      openAddExpenseWithPrefill: (data) =>
        set({ activeModal: 'addExpense', expensePrefill: data }),
      openAddPaymentMethodWithPrefill: (data) =>
        set({ activeModal: 'addPaymentMethod', pmPrefill: data }),
      clearPmPrefill: () => set({ pmPrefill: null }),
      openAddSubscriptionWithPrefill: (data) => set({ subscriptionPrefill: data }),
      clearSubscriptionPrefill: () => set({ subscriptionPrefill: null }),
      dismissBanner: (key) =>
        set((st) => (st.dismissedBanners.includes(key) ? st : { dismissedBanners: [...st.dismissedBanners, key] })),
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
          markingIncome: null,
          assignTarget: null,
          expensePrefill: null,
          pmPrefill: null,
          subscriptionPrefill: null,
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
        dismissedBanners: state.dismissedBanners,
      }),
    }
  )
)
