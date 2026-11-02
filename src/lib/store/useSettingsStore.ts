import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeLocalStorage } from '@/lib/store/safeLocalStorage'
import type { IncomeSourceType, PaymentMethodType } from '@/lib/store/types'
import type { StudioDraft } from '@/lib/budget/studioDraft'
// Type-only: erased at compile time, so this does not create a runtime cycle
// between the store and the component that renders the mood.
import type { BuddgyMood } from '@/components/ai/BuddgyIcon'

export interface ExpensePrefill {
  date?: string
  description?: string
  amount?: string
  currency?: string
  category?: string
  paymentMethod?: string
  notes?: string
}

export interface AccountPrefill {
  /** Bare provider name; the sheet resolves it to a catalogue brand. */
  provider: string
  last4: string
}

export interface PmPrefill {
  /** Bare provider name (no ••last4 suffix) — the sheet composes the display name. */
  name: string
  last4: string
  /** Type implied by the source (e.g. an SMS card transaction); overrides the brand default. */
  type?: PaymentMethodType
}

/** Seed for the New payday sheet. Every field optional: a starter card only knows the type. */
export interface PaydayPrefill {
  name?: string
  amount?: number
  currency?: string
  sourceType?: IncomeSourceType
  dayOfMonth?: number
  paymentMethodId?: string
}

/** Persisted resting position of the draggable Buddgy orb. */
export interface BuddgyOrbPosition {
  side: 'left' | 'right'
  top: number
}

export interface BuddgyNudgeLog {
  day: string
  count: number
  lastAt: number
  seen: string[]
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
  markingIncome: { sourceId: string; occKey: string; month?: string } | null
  /** Assign sheet target: the existing one-time event id being assigned from a row swipe. */
  assignTarget: { eventId: string | null } | null
  expensePrefill: ExpensePrefill | null
  pmPrefill: PmPrefill | null
  /** A bank account seen in messages, waiting for the Accounts page to open its add sheet. */
  accountPrefill: AccountPrefill | null
  /** The add-subscription sheet on the Subscriptions page (Quick add opens it). Not persisted. */
  subscriptionAddOpen: boolean
  setSubscriptionAddOpen: (open: boolean) => void
  /** The SMS review sheet on the Subscriptions page (opened by the detection prompt). Not persisted. */
  subscriptionReviewOpen: boolean
  setSubscriptionReviewOpen: (open: boolean) => void
  /**
   * Banner keys the user has dismissed (persisted). Without this a detection banner
   * reappears on every visit to the dashboard, which trains people to ignore it.
   */
  dismissedBanners: string[]
  /**
   * Prompt keys snoozed from the drop-down stack (✕ or swipe up) → ISO time they return.
   * Unlike a dismissal, a snooze keeps coming back until one of the prompt's buttons is used.
   */
  snoozedBanners: Record<string, string>
  /** Status pills (offline, sync failed) hidden by a swipe → ISO time they may return. */
  hiddenStatusUntil: Record<string, string>
  /** Seed for the New payday sheet ("Make this recurring", Paydays starters). */
  paydayPrefill: PaydayPrefill | null
  /** Payday to open on arrival at Paydays ("Open in Paydays"); consumed once. */
  paydayFocusId: string | null
  setPaydayFocusId: (id: string | null) => void
  /** Setting to scroll to and highlight on arrival from settings search; consumed once. */
  settingsFocusId: string | null
  /** Buddgy asked to start the guided budget setup; the Budget page opens it once and clears this. Not persisted. */
  budgetStudioRequested: boolean
  /** The account whose data this session has actually pulled from the server; null until the first pull lands. Not persisted. */
  serverSyncedFor: string | null
  markServerSynced: (userId: string | null) => void
  requestBudgetStudio: () => void
  clearBudgetStudioRequest: () => void
  setSettingsFocusId: (id: string | null) => void
  /** Bring back every banner and prompt the user dismissed or snoozed. */
  restoreDismissedPrompts: () => void
  monthFilter: string
  /** Pre-filled AI chat input (e.g. voice "Open in chat" hands off the transcript). */
  aiChatSeed: string | null
  /** Send `aiChatSeed` as soon as the chat opens instead of just pre-filling it. */
  aiChatSeedSend: boolean
  /** Buddgy may speak up with screen-aware tips (persisted; AI settings switch). */
  buddgyNudges: boolean
  setBuddgyNudges: (on: boolean) => void
  /** Throttle ledger for tips: per-day count, last shown time, ids already shown today (persisted). */
  buddgyNudgeLog: BuddgyNudgeLog
  logBuddgyNudge: (id: string) => void
  /** Facts the user asked Buddgy to remember — device-local, fed into every prompt (persisted). */
  buddgyNotes: string[]
  /** `YYYY-MM` cycles whose month-close prompt is done, applied or dismissed. */
  budgetClosedCycles: string[]
  closeBudgetCycle: (cycleKey: string) => void
  /** The unfinished budget Studio run, so leaving mid-flow loses nothing (persisted). */
  budgetStudioDraft: StudioDraft | null
  saveBudgetStudioDraft: (draft: StudioDraft) => void
  clearBudgetStudioDraft: () => void
  /** When false, chat stops saving new notes. */
  buddgyLearning: boolean
  setBuddgyLearning: (on: boolean) => void
  clearBuddgyNotes: () => void
  addBuddgyNotes: (notes: string[]) => void
  removeBuddgyNote: (note: string) => void
  /** Mute spoken-aloud answers in the voice flow (persisted). */
  voiceSpeakMuted: boolean
  /** The settings-page sheet being asked to open (from search or Buddgy). Not persisted. */
  settingsSheet: SettingsSheetId | null
  openSettingsSheet: (sheet: SettingsSheetId | null) => void
  /** The person switched notifications off in Settings (persisted). The OS permission is separate. */
  pushOptOut: boolean
  setPushOptOut: (off: boolean) => void
  /** Latest settings searches, newest first (persisted). */
  recentSettingSearches: string[]
  rememberSettingSearch: (query: string) => void
  /** When opening add-debt sheet from "Record payment" on a card */
  debtSheetPaymentOnly: boolean
  debtSheetPrefillDebtId: string | null
  /** When opening add-debt, jump straight to this family's form (skip the picker). */
  debtSheetPresetFamily: 'personal' | 'installment' | null
  /** Edit sheet opened from a card's "Set a payoff goal" CTA: open with the goal toggle on. */
  debtSheetGoalIntent: boolean
  openDebtGoalEdit: (debtId: string) => void
  /** Draggable Buddgy orb resting position (persisted). */
  buddgyOrb: BuddgyOrbPosition
  setBuddgyOrb: (pos: BuddgyOrbPosition) => void
  /**
   * Which moods are currently true. Buddgy shows the highest-priority one, so
   * callers set and clear the mood they own without having to know about the
   * others — a finished OCR scan can't wipe an `offline` state it never set.
   * NOT persisted: it describes this moment, not a preference.
   */
  buddgyActive: Partial<Record<BuddgyMood, boolean>>
  /** Turn one mood on or off. `done`/`happy`/`error` self-clear (see the hook). */
  setBuddgyMood: (mood: BuddgyMood, active: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setActiveModal: (modal: string | null) => void
  setEditingExpenseId: (expenseId: string | null) => void
  setEditingDebtId: (debtId: string | null) => void
  setEditingIncomeId: (incomeId: string | null) => void
  setEditingIncomeEventId: (id: string | null) => void
  /** `month` (`yyyy-MM`) when the payday is not in `monthFilter` — a late one from last month. */
  openAmountReceived: (sourceId: string, occKey: string, month?: string) => void
  openAssignIncome: (target: { eventId: string | null }) => void
  setExpensePrefill: (data: ExpensePrefill | null) => void
  openAddExpenseWithPrefill: (data: ExpensePrefill) => void
  openAddPaymentMethodWithPrefill: (data: PmPrefill) => void
  clearPmPrefill: () => void
  openAddAccountWithPrefill: (data: AccountPrefill) => void
  clearAccountPrefill: () => void
  dismissBanner: (key: string) => void
  snoozeBanner: (key: string, untilISO: string) => void
  hideStatus: (key: string, untilISO: string) => void
  openNewPayday: (prefill?: PaydayPrefill) => void
  setMonthFilter: (month: string) => void
  openAiChatWithSeed: (text: string, send?: boolean) => void
  clearAiChatSeed: () => void
  setVoiceSpeakMuted: (muted: boolean) => void
  openDebtSheetNew: (family?: 'personal' | 'installment') => void
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

export type SettingsSheetId = 'currencies' | 'converter' | 'feedback' | 'inbox' | 'board' | 'notCounted' | 'about' | 'export' | 'deleteAccount'

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
      accountPrefill: null,
      subscriptionAddOpen: false,
      setSubscriptionAddOpen: (open) => set({ subscriptionAddOpen: open }),
      subscriptionReviewOpen: false,
      setSubscriptionReviewOpen: (open) => set({ subscriptionReviewOpen: open }),
      dismissedBanners: [],
      snoozedBanners: {},
      hiddenStatusUntil: {},
      paydayPrefill: null,
      paydayFocusId: null,
      setPaydayFocusId: (id) => set({ paydayFocusId: id }),
      settingsFocusId: null,
      budgetStudioRequested: false,
      serverSyncedFor: null,
      markServerSynced: (userId) => set({ serverSyncedFor: userId }),
      requestBudgetStudio: () => set({ budgetStudioRequested: true }),
      clearBudgetStudioRequest: () => set({ budgetStudioRequested: false }),
      setSettingsFocusId: (id) => set({ settingsFocusId: id }),
      restoreDismissedPrompts: () => set({ dismissedBanners: [], snoozedBanners: {}, hiddenStatusUntil: {} }),
      monthFilter: getCurrentMonth(),
      aiChatSeed: null,
      aiChatSeedSend: false,
      buddgyNudges: true,
      setBuddgyNudges: (on) => set({ buddgyNudges: on }),
      buddgyNudgeLog: { day: '', count: 0, lastAt: 0, seen: [] },
      logBuddgyNudge: (id) =>
        set((st) => {
          const day = new Date().toDateString()
          const prev = st.buddgyNudgeLog.day === day ? st.buddgyNudgeLog : { day, count: 0, lastAt: 0, seen: [] }
          return { buddgyNudgeLog: { day, count: prev.count + 1, lastAt: Date.now(), seen: [...prev.seen, id] } }
        }),
      buddgyNotes: [],
      budgetClosedCycles: [],
      closeBudgetCycle: (cycleKey) =>
        set((st) => (st.budgetClosedCycles.includes(cycleKey) ? st : { budgetClosedCycles: [...st.budgetClosedCycles, cycleKey].slice(-24) })),
      budgetStudioDraft: null,
      saveBudgetStudioDraft: (draft) => set({ budgetStudioDraft: draft }),
      clearBudgetStudioDraft: () => set({ budgetStudioDraft: null }),
      buddgyLearning: true,
      setBuddgyLearning: (on) => set({ buddgyLearning: on }),
      clearBuddgyNotes: () => set({ buddgyNotes: [] }),
      // ponytail: newest 20 kept; a smarter merge (dedupe by meaning) if notes start contradicting.
      addBuddgyNotes: (notes) =>
        set((st) => ({ buddgyNotes: [...st.buddgyNotes.filter((n) => !notes.includes(n)), ...notes].slice(-20) })),
      removeBuddgyNote: (note) => set((st) => ({ buddgyNotes: st.buddgyNotes.filter((n) => n !== note) })),
      voiceSpeakMuted: false,
      settingsSheet: null,
      openSettingsSheet: (sheet) => set({ settingsSheet: sheet }),
      pushOptOut: false,
      setPushOptOut: (off) => set({ pushOptOut: off }),
      recentSettingSearches: [],
      rememberSettingSearch: (query) =>
        set((st) => {
          const q = query.trim()
          return q ? { recentSettingSearches: [q, ...st.recentSettingSearches.filter((r) => r !== q)].slice(0, 5) } : st
        }),
      debtSheetPaymentOnly: false,
      debtSheetPrefillDebtId: null,
      debtSheetPresetFamily: null,
      debtSheetGoalIntent: false,
      buddgyOrb: { side: 'right', top: 620 },
      setBuddgyOrb: (pos) => set({ buddgyOrb: pos }),
      buddgyActive: {},
      setBuddgyMood: (mood, active) =>
        set((state) => {
          if (Boolean(state.buddgyActive[mood]) === active) return state
          const next = { ...state.buddgyActive }
          if (active) next[mood] = true
          else delete next[mood]
          return { buddgyActive: next }
        }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setEditingExpenseId: (expenseId) => set({ editingExpenseId: expenseId }),
      setEditingDebtId: (debtId) => set({ editingDebtId: debtId }),
      setEditingIncomeId: (incomeId) => set({ editingIncomeId: incomeId }),
      setEditingIncomeEventId: (id) => set({ editingIncomeEventId: id }),
      openAmountReceived: (sourceId, occKey, month) =>
        set({ markingIncome: { sourceId, occKey, month }, activeModal: 'amountReceived' }),
      openAssignIncome: (target) => set({ assignTarget: target, activeModal: 'assignIncome' }),
      setExpensePrefill: (data) => set({ expensePrefill: data }),
      openAddExpenseWithPrefill: (data) =>
        set({ activeModal: 'addExpense', expensePrefill: data }),
      openAddPaymentMethodWithPrefill: (data) =>
        set({ activeModal: 'addPaymentMethod', pmPrefill: data }),
      clearPmPrefill: () => set({ pmPrefill: null }),
      openAddAccountWithPrefill: (data) => set({ accountPrefill: data }),
      clearAccountPrefill: () => set({ accountPrefill: null }),
      dismissBanner: (key) =>
        set((st) => (st.dismissedBanners.includes(key) ? st : { dismissedBanners: [...st.dismissedBanners, key] })),
      snoozeBanner: (key, untilISO) => set((st) => ({ snoozedBanners: { ...st.snoozedBanners, [key]: untilISO } })),
      hideStatus: (key, untilISO) => set((st) => ({ hiddenStatusUntil: { ...st.hiddenStatusUntil, [key]: untilISO } })),
      openNewPayday: (prefill) => set({ paydayPrefill: prefill ?? null, activeModal: 'addPayday' }),
      setMonthFilter: (month) => set({ monthFilter: month }),
      openAiChatWithSeed: (text, send = false) => set({ activeModal: 'aiChat', aiChatSeed: text, aiChatSeedSend: send }),
      clearAiChatSeed: () => set({ aiChatSeed: null, aiChatSeedSend: false }),
      setVoiceSpeakMuted: (muted) => set({ voiceSpeakMuted: muted }),
      openDebtSheetNew: (family) =>
        set({
          debtSheetPaymentOnly: false,
          debtSheetPrefillDebtId: null,
          debtSheetPresetFamily: family ?? null,
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
      openDebtGoalEdit: (debtId) =>
        set({ editingDebtId: debtId, debtSheetGoalIntent: true, debtSheetPaymentOnly: false, debtSheetPrefillDebtId: null, activeModal: 'editDebt' }),
      resetDebtSheetIntent: () =>
        set({ debtSheetPaymentOnly: false, debtSheetPrefillDebtId: null, debtSheetPresetFamily: null, debtSheetGoalIntent: false }),
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
          accountPrefill: null,
          subscriptionAddOpen: false,
          subscriptionReviewOpen: false,
          monthFilter: getCurrentMonth(),
          aiChatSeed: null,
          aiChatSeedSend: false,
          voiceSpeakMuted: false,
          debtSheetPaymentOnly: false,
          debtSheetPrefillDebtId: null,
        }),

      reset: () => {
        get().resetSettings()
        // Persisted per-account fields: left in memory they would carry into the next sign-in in the same tab.
        set({ budgetClosedCycles: [], budgetStudioDraft: null, buddgyNotes: [], serverSyncedFor: null, dismissedBanners: [], snoozedBanners: {}, pushOptOut: false })
      },
    }),
    {
      name: 'buddget-ui-settings',
      storage: createJSONStorage(() => createSafeLocalStorage()),
      partialize: (state) => ({
        voiceSpeakMuted: state.voiceSpeakMuted,
        pushOptOut: state.pushOptOut,
        recentSettingSearches: state.recentSettingSearches,
        buddgyOrb: state.buddgyOrb,
        dismissedBanners: state.dismissedBanners,
        snoozedBanners: state.snoozedBanners,
        buddgyNudges: state.buddgyNudges,
        buddgyNudgeLog: state.buddgyNudgeLog,
        buddgyNotes: state.buddgyNotes,
        budgetClosedCycles: state.budgetClosedCycles,
        budgetStudioDraft: state.budgetStudioDraft,
        buddgyLearning: state.buddgyLearning,
      }),
    }
  )
)
