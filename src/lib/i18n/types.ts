/** Buddget i18n dictionary shape — every key in ar.ts must match en.ts exactly. */

/** Tutorial tour copy. Top-level so copyKeys in the manifest stay short
 *  (`tour.debug.fab.title`). Tours tied to onboarding modals still use
 *  this namespace — the modal tutorials aren't onboarding-exclusive. */
export interface TourDictionary {
  debug: {
    fab: { title: string; body: string }
    checklist: { title: string; body: string }
    navHome: { title: string; body: string }
  }
  missing: { title: string; body: string }
  modal: {
    pm: {
      name: { title: string; body: string }
      type: { title: string; body: string }
      currency: { title: string; body: string }
      save: { title: string; body: string }
    }
    income: {
      name: { title: string; body: string }
      amount: { title: string; body: string }
      recurring: { title: string; body: string }
      save: { title: string; body: string }
    }
    debt: {
      type: { title: string; body: string }
      balance: { title: string; body: string }
      save: { title: string; body: string }
    }
    savings: {
      name: { title: string; body: string }
      balance: { title: string; body: string }
      save: { title: string; body: string }
    }
    subscription: {
      amount: { title: string; body: string }
      cycle: { title: string; body: string }
      save: { title: string; body: string }
    }
    goal: {
      name: { title: string; body: string }
      save: { title: string; body: string }
    }
  }
  postOnboard: {
    planRoot: { title: string; body: string }
    categoryRow: { title: string; body: string }
    rebuild: { title: string; body: string }
    dashboard: { title: string; body: string }
    fab: { title: string; body: string }
    savings: { title: string; body: string }
    expenses: { title: string; body: string }
    profile: { title: string; body: string }
    navHome: { title: string; body: string }
    navExpenses: { title: string; body: string }
    navDebts: { title: string; body: string }
    navMore: { title: string; body: string }
    firstDebt: {
      title: string
      body: (name: string) => string
      fallbackName: string
    }
    firstGoal: {
      title: string
      body: (name: string) => string
      fallbackName: string
    }
  }
}

export interface Dictionary {
  tour: TourDictionary
  tutorialSkipConfirm: {
    /** Title shown when the user taps the header "Skip" button; prompts
     *  them to choose between skipping the current step and skipping
     *  the whole tour. */
    prompt: string
    skipStep: string
    skipAll: string
  }
  syncFailures: {
    oneDidntSync: string
    manyDidntSync: (count: number) => string
    autoRetryNote: string
    expand: string
    collapse: string
    dismiss: string
  }
  /** Document layout direction; kept `ltr` for Arabic so chrome matches English. */
  dir: 'ltr' | 'rtl'
  locale: string

  common: {
    save: string
    /** Settings force-sync button label */
    saveAndSync: string
    /** Toast shown after a successful force-sync */
    savedSynced: string
    /** Settings save-button confirmation state */
    saved: string
    /** Pull-to-refresh success message */
    refreshed: string
    cancel: string
    delete: string
    edit: string
    back: string
    close: string
    selectDate: string
    /** Walkthrough / tutorial primary action */
    next: string
    confirm: string
    remove: string
    loading: string
    unknown: string
    undo: string
    dash: string
    signIn: string
    signUp: string
    signOut: string
    user: string
    or: string
    all: string
    none: string
    yes: string
    no: string
    ok: string
    done: string
    neverMind: string
    required: string
    optional: string
    goTo: string
    seeAll: string
    today: string
    yesterday: string
    daysLeft: (n: number) => string
    selected: (n: number) => string
    pickAtLeast: (n: number) => string
    upTo: (n: number) => string
    showingExpenses: (n: number) => string
    totalSpent: (amount: string) => string
    percentSymbol: string
    confirmDeleteGeneric: string
    getStarted: string
    tryAgain: string
    /** Month/year picker — year dropdown label */
    yearLabel: string
    /** Accessible label for EN/AR language control */
    languageSwitcherAria: string
    offlineBanner: string
    toastExpenseLogged: string
    toastIncomeAdded: string
    toastDebtAdded: string
    toastDebtPaymentRecorded: string
    toastSavingsDeposited: string
    ariaSwapCurrencies: string
    pressBackAgainToExit: string
  }

  nav: {
    dashboard: string
    budgetSetup: string
    expenses: string
    income: string
    savings: string
    debts: string
    reports: string
    subscriptions: string
    home: string
    more: string
    quickAdd: string
    profileMenu: string
    settings: string
  }

  brand: {
    tagline: string
    footerVersion: string
    termsLink: string
    privacyLink: string
  }

  dashboard: {
    kpiIncome: string
    kpiIncomeIcon: string
    kpiIncomeTrend: string
    kpiSpent: string
    kpiSpentIcon: string
    kpiSpentTrend: string
    kpiRemaining: string
    kpiRemainingIcon: string
    kpiRemainingTrend: string
    kpiSavings: string
    kpiSavingsIcon: string
    kpiSavingsTrend: string
    kpiDebt: string
    kpiDebtIcon: string
    kpiDebtTrend: string
    kpiNetWorth: string
    kpiNetWorthIcon: string
    kpiNetWorthTrend: string
    kpiNetWorthGoldNote: string
    incomeBlockedHint: string
    budgetUsedLabel: string
    statusOverBudget: string
    statusCloseToBudget: string
    statusWithinBudget: string
    remainingSuffix: string
    overBudgetSuffix: string
    noBudgetRingLabel: string
    noBudgetHint: string
    spentLabel: string
    monthEnded: string
    categoryTitle: string
    categoryBreakdownTabsAria: string
    categoryTabExpenses: string
    categoryTabSavings: string
    categorySavingsHint: string
    categorySavingsHoldingsLabel: string
    categorySavingsManageLink: string
    /** Outer tab: expense/savings breakdown vs caps */
    categoryTabSpending: string
    /** Outer tab: edit monthly budget amounts / % of income */
    categoryTabBudgetSetup: string
    recentTitle: string
    recentEmpty: string
    recentEmptyDesc: string
    categoryEmptyTitle: string
    categoryEmptyDesc: string
    categoryEmptyCta: string
    recentSeeAll: string
    confirmDeleteExpense: string
    savingsTitle: string
    savingsLink: string
    savingsStashedAway: string
    savingsDotSeparator: string
    savingsAddedThisMonth: string
    savingsMonthlyTarget: string
    savingsSubAccounts: string
    savingsSubLegacy: string
    savingsSubExpensesTagged: string
    savingsNetLedgerMonth: string
    debtTitle: string
    debtBadgeCash: string
    debtPayments: (n: number) => string
    debtPaymentsTowardsThis: string
    loadingMessage: string
    paceLabel: string
    projectedLabel: string
    suggestedDailyLabel: string
    paceOnTrack: string
    paceWarning: string
    paceOver: string
    cutBackHint: string

    // 2026-04 dashboard redesign: blended dark hero + compact card stack.
    heroLeftToSpend: string
    heroUsedSuffix: string
    heroStatIncome: string
    heroStatSpent: string
    heroStatSaved: string
    heroStatIn: string
    heroStatOut: string
    heroNetWorthLabel: string
    heroStatSavings: string
    heroStatDebt: string
    netWorthThisMonth: string
    paceBadgeOnTrackTitle: string
    paceBadgeSlowDownTitle: string
    paceBadgeOverTitle: string
    paceBadgeSubtitle: (paceLabel: string, targetLabel: string, daysLeft: number) => string
    heroPaceDaysLeft: (daysLeft: number) => string
    paceBadgeCutBack: (names: string) => string
    categoryStatusAllWithin: string
    categoryStatusNearLimit: (name: string) => string
    categoryStatusOver: (names: string) => string
    heroSetupGreeting: string
    heroPace: (perDay: string, status: string, daysLeft: number) => string
    sectionCategoriesTitle: string
    sectionTxTitle: string
    sectionSeeAll: string
    summarySavingsLabel: string
    summaryDebtLabel: string
    summarySavedThisMonth: (amount: string) => string
    summaryProjectedSavingsLabel: string
    summarySavedLabel: string
    summaryProjectedSavingsSubtext: (amount: string) => string
    summarySavedActualSubtext: string
    summaryDebtActive: (count: number) => string
    summaryDebtActiveNone: string
  }

  expenses: {
    pageTitle: string
    requireAuth: string
    emptyIcon: string
    emptyTitle: string
    emptyDesc: string
    emptyButton: string
    colDate: string
    colWhatFor: string
    colCategory: string
    colPaidWith: string
    colAmount: string
    colAction: string
    footerButton: string
    filterAllCategories: string
    filterAllMethods: string
    searchPlaceholder: string
    downloadData: string
    editPurchase: string
    removePurchase: string
    confirmDelete: string
    badgeDebt: string
    spentThisMonth: string
    entries: string
    avgPerDay: string
    daysCount: string
    statusReturned: string
    statusBlocked: string
    addExpenseCta: string
    filtersTitle: string
    resetAll: string
    showResults: string
    labelCategory: string
    labelCategories: string
    labelPayment: string
    labelAmount: string
    amountRange: string
    minimum: string
    maximum: string
    selectMulti: string
    doneCta: string
    badgeSms: string
    badgeRefunded: string
    badgeDeclined: string
    swipeDelete: string
    expenseDeleted: string
    fileSaved: string
  }

  addExpense: {
    sheetTitle: string
    editTitle: string
    labelWhen: string
    labelDescription: string
    placeholderDescription: string
    labelAmount: string
    placeholderAmount: string
    labelCurrency: string
    labelCategory: string
    labelSubcategory: string
    labelPaymentMethod: string
    labelRepeats: string
    labelNotes: string
    placeholderNotes: string
    buttonSubmit: string
    buttonSave: string
    creditCardOutstandingHint: (cardName: string, amountLabel: string) => string
  }

  /** Add/Edit Expense sheet redesign + shared date picker. */
  expenseForm: {
    titleAdd: string
    titleEdit: string
    amount: string
    currency: string
    description: string
    descriptionPlaceholder: string
    category: string
    paymentMethod: string
    addNote: string
    notePlaceholder: string
    charged: string
    refunded: string
    declined: string
    nonSpendHint: string
    saveExpense: string
    saveChanges: string
    cueAmount: string
    cueDescription: string
    splitInstallments: string
    installmentFirstDue: string
    installmentPayFrom: string
    installmentEach: string
    currencyTitle: string
    paymentTitle: string
    addPaymentMethod: string
    defaultBadge: string
    name: string
    namePlaceholder: string
    type: string
    last4: string
    setDefault: string
    confirmTitle: string
    confirmBody: string
    discardChanges: string
    today: string
    /** Canonical category id → short grid label. */
    categoryLabels: Record<string, string>
    /** Currency code → full name. */
    currencyNames: Record<string, string>
    /** Payment method type → label. */
    paymentTypeLabels: Record<string, string>
  }

  income: {
    pageTitle: string
    requireAuth: string
    addSource: string
    helperText: string
    emptyIcon: string
    emptyTitle: string
    emptyDesc: string
    emptyButton: string
    oneTime: string
    recurringMonthly: (day: number) => string
    recurringBiweekly: string
    recurringWeekly: string
    perMonth: (amount: string) => string
    perPaycheck: (amount: string) => string
    perWeek: (amount: string) => string
    monthlyEquiv: (amount: string) => string
    monthlyIncomeLabel: string
    recurringLabel: string
    oneTimeLabel: string
    recurringSourcesLabel: string
    incomeThisMonthLabel: string
    mainAccount: string
    perMoSuffix: string
    freqMonthlyDay: (day: number) => string
    freqBiweeklyShort: string
    freqWeeklyShort: string
    effectiveStart: string
    effectiveEnd: string
    receivedDate: string
    confirmDelete: string
    deleteWithDebtTitle: string
    deleteWithDebtBody: (debtName: string) => string
    deleteBoth: string
    keepDebt: string
    linkToRecurring: string
    notLinkedToRecurring: string
    looksLikeTemplate: (name: string) => string
    statusLabel: string
    statusReceived: string
    statusLate: string
    statusPartial: string
    statusMissed: string
    statusPending: string
    expectedPerMonth: (amount: string) => string
    receivedOfExpected: (received: string, expected: string) => string
    remainingLeft: (amount: string) => string
    fullyReceived: string
    extraReceived: (amount: string) => string
    otherIncomeLabel: string
    sourceTypeSalary: string
    sourceTypeBonus: string
    sourceTypeSideHustle: string
    sourceTypeInvestment: string
    sourceTypeSavings: string
    sourceTypeDebt: string
    sourceTypeGift: string
    sourceTypeRefund: string
    sourceTypeOther: string
    sourceTypeLabel: string
    debtPersonLabel: string
    debtPersonPlaceholder: string
    linkedDebtNote: string
    linkedSavingsNote: string
    linkedInvestmentNote: string
    linkedToDebt: (name: string) => string
    linkedAccountName: (name: string) => string
    // redesigned income surface (page · cards · amount sheet · assign sheet)
    expectedThisMonthLabel: string
    receivedColLabel: string
    oneTimeSuffix: (amount: string) => string
    pctOfExpected: (pct: number) => string
    toCome: (amount: string) => string
    addIncomeCta: string
    recurringHeading: string
    sourcesCount: (n: number) => string
    swipeHint: string
    expectedPerMoLabel: string
    tapPaydayTip: string
    /** Card CTA to log/adjust a payday's received amount. */
    receivedBtn: string
    /** Card CTA to skip an unpaid payday (mark it missed). */
    missedBtn: string
    /** Amount-sheet chip that fills the input with the full expected amount. */
    fullBtn: string
    /** Status suffixes appended to a payday's date label. */
    bracketLate: string
    bracketMissed: string
    bracketPartial: string
    amountReceivedTitle: string
    amountSheetSubtitle: (date: string, source: string, expected: string) => string
    amountReceivedLabel: string
    matchesExpected: string
    shortOfExpected: (short: string, expected: string) => string
    markReceivedBtn: string
    saveAsPartialBtn: string
    /** Primary CTA when editing an already-logged payment. */
    saveChangesBtn: string
    /** Hint when tapping a payday that is not yet in turn (sequential settling). */
    earlierPaydayFirst: string
    /** aria-label for the card's pencil (edit source) button. */
    editSourceAria: string
    assignTitle: string
    assignSubtitle: string
    fillsPayday: (date: string) => string
    /** Card caption prompting the user to tap a source before assigning. */
    assignTapHint: string
    assignConfirm: (source: string) => string
    allIncomeHeading: string
    thisMonthCount: (n: number) => string
    swipeAssign: string
    swipeDelete: string
  }

  editIncome: {
    title: string
    labelSource: string
    labelAmount: string
    labelCurrency: string
    labelRecurring: string
    labelFrequency: string
    labelDayOfMonth: string
    labelNotes: string
    freqHint: string
    budgetNote: (currency: string) => string
    buttonSave: string
    labelSourceType: string
    salaryRecurringHint: string
    debtDescriptionLabel: string
    debtDescriptionPlaceholder: string
  }

  addIncome: {
    sheetTitle: string
    labelSource: string
    placeholderSource: string
    labelAmount: string
    placeholderAmount: string
    labelCurrency: string
    labelRecurring: string
    labelFrequency: string
    labelDayOfMonth: string
    labelNotes: string
    placeholderNotes: string
    buttonSubmit: string
    labelSourceType: string
    salaryRecurringHint: string
    debtDescriptionLabel: string
    debtDescriptionPlaceholder: string
    labelPaymentMethod: string
    debtUsesIncomeAmount: string
    // redesigned add/edit modal
    addSubtitleRecurring: string
    addSubtitleOneTime: string
    tabRecurring: string
    tabOneTime: string
    incomeTypeLabel: string
    howOftenLabel: string
    paydayLabel: string
    /** Beside the Payday title for biweekly/weekly: guides picking the 2 or 4 days. */
    paydayHelper: (count: number) => string
    /** Toggle in the payday grid's spare cells: manual multi-day selection. */
    paydayEditBtn: string
    /** Amount label when the source is biweekly/weekly (per paycheck, not per month). */
    amountPerPaycheckLabel: string
    /** Live preview under the amount: typical monthly equivalent. */
    perMonthEquiv: (amount: string) => string
    freqMonthly: string
    freqBiweekly: string
    freqWeekly: string
    namePlaceholder: string
    todayLabel: string
    assignCardTitle: string
    assignCardBody: string
    assignBtn: string
    assignChange: string
    assignRemove: string
    assignedToSource: (name: string) => string
  }

  savings: {
    pageTitle: string
    requireAuth: string
    totalLine: (currency: string) => string
    addTitle: string
    labelName: string
    placeholderName: string
    labelKind: string
    optionLiquid: string
    optionInvestment: string
    labelType: string
    labelCurrentAmount: string
    labelCurrentBalance: string
    labelCurrency: string
    buttonAdd: string
    createAccountButton: string
    sectionLiquid: string
    emptyLiquid: string
    sectionInvestment: string
    emptyInvestment: string
    subtypeBank: string
    subtypeCash: string
    subtypeGold: string
    subtypeStocks: string
    subtypeCrypto: string
    subtypeRealEstate: string
    subtypeOther: string
    bucketLiquid: string
    bucketInvestment: string
    confirmDelete: string
    addAccount: string
    addToSavings: string
    withdraw: string
    updateBalance: string
    emptyAccounts: string
    emptyAccountsCta: string
    historyTitle: string
    filterAllSavings: string
    deposit: string
    withdrawal: string
    sheetAddTitle: string
    sheetAddNewTitle: string
    tabDeposit: string
    tabAddAccount: string
    sheetEditTitle: string
    sheetWithdrawTitle: string
    sheetUpdateTitle: string
    labelWhichSavings: string
    labelAmount: string
    labelNotes: string
    labelReason: string
    labelNewBalance: string
    currentBalanceLabel: string
    available: string
    submitAdd: string
    submitWithdraw: string
    submitUpdate: string
    differenceDeposit: string
    differenceWithdrawal: string
    exceedsBalance: string
    confirmDeleteSavings: string
    labelPickIcon: string
    goldCurrencyHint: string
    labelProductCategory: string
    categorySavings: string
    categoryInvestment: string
    recurringQuestion: string
    recurringOneTime: string
    recurringRepeat: string
    labelFrequency: string
    freqMonthly: string
    labelDayOfMonth: string
    liveCryptoSoon: string
    liveStocksSoon: string
    goldAedUnavailable: string
    tagRecurring: string
    netWorthShort: string
    totalSavedShort: string
    breakdownTitle: string
    breakdownRowSavings: string
    breakdownRowInvestments: string
    breakdownRowMonth: string
    breakdownRowDebt: string
    breakdownRowTotal: string
    types: {
      bank: string
      cash: string
      gold: string
      stablecoin: string
      crypto: string
      stocks: string
      real_estate: string
      other: string
    }
    placeholders: {
      bank: string
      cash: string
      gold: string
      stablecoin: string
      crypto: string
      stocks: string
      real_estate: string
      other: string
    }
  }

  debts: {
    pageTitle: string
    requireAuthNew: string
    requireAuthPayment: string
    requireAuthRecurring: string
    buttonPayDebt: string
    buttonAddDebt: string
    totalStillOwed: string
    activeDebtsCount: (n: number) => string
    buttonRecurring: string
    buttonTrack: string
    emptyIcon: string
    emptyTitle: string
    emptyDesc: string
    emptyButton: string
    sectionRecurring: string
    recurringHelp: string
    unknownBalance: string
    unknownDebt: string
    emptyActiveTitle: string
    emptyActiveDesc: string
    freqMonthly: string
    freqBiweekly: string
    freqWeekly: string
    paymentNext: string
    activeLabel: string
    confirmDeleteSchedule: string
    paymentHistory: (name: string) => string
    paymentHistorySectionTitle: string
    filterByDebt: string
    allDebtsFilter: string
    colBalance: string
    colDebt: string
    debtHistorySectionTitle: string
    historyColDebt: string
    historyColType: string
    historyColTotal: string
    historyColPaid: string
    historyColStatus: string
    historyColSettled: string
    statusCleared: string
    statusInProgress: string
    debtTypePersonal: string
    debtTypeInstallment: string
    debtTypeGeneral: string
    debtTypeLegacy: string
    deletePaymentAria: string
    clearedMessage: string
    celebrationTitle: string
    celebrationTapHint: string
    buttonLogPayment: string
    owedTo: string
    labelStartedAt: string
    labelStillToGo: string
    paymentsSoFar: (n: number) => string
    percentCleared: (pct: string) => string
    colDate: string
    colPaid: string
    colStillToGo: string
    colNotes: string
    confirmDeletePayment: string
    emptyPayments: string
    editSheetTitle: string
    goalSectionTitle: string
    goalEditButton: string
    confirmRemoveGoal: string
    installmentProgress: (paid: number, total: number) => string
    installmentNextDue: (date: string) => string
    goalPayoffLine: string
    goalTargetPassed: string
    debtTypeCreditCard: string
    outstandingBalance: string
    availableLimit: string
    creditLimit: string
    utilization: string
    dueDate: string
    daysUntilDue: string
    minimumPayment: string
    thisMonthCharges: string
    payNow: string
    payNextInstallment: string
    viewCharges: string
    creditCardSetupHint: string
  }

  addDebt: {
    tabNew: string
    tabPayment: string
    titleNew: string
    titlePayment: string
    titlePayDebt: string
    labelName: string
    placeholderName: string
    labelPerson: string
    placeholderPerson: string
    labelDescription: string
    placeholderDescription: string
    labelGold: string
    labelTotalGrams: string
    labelTotalAmount: string
    placeholderAmount: string
    labelCurrency: string
    labelGoldPurity: string
    labelNotes: string
    buttonSubmit: string
    buttonSubmitCreditCard: string
    debtTypeLabel: string
    debtTypePersonal: string
    debtTypeInstallment: string
    debtTypeGeneral: string
    debtTypeCreditCard: string
    placeholderCardName: string
    creditLimitLabel: string
    currentOutstandingLabel: string
    currentOutstandingHint: string
    paymentDueDayLabel: string
    gracePeriodLabel: string
    gracePeriodDays: string
    minPaymentLabel: string
    installmentProviderLabel: string
    providerCreditCard: string
    providerTabby: string
    providerTamara: string
    providerOther: string
    whichCreditCard: string
    whichCreditCardPlaceholder: string
    last4Label: string
    last4Placeholder: string
    labelRelationship: string
    labelDirection: string
    directionIOwe: string
    directionTheyOwe: string
    labelItemName: string
    labelInstallments: string
    labelInstallmentFreq: string
    labelStartDate: string
    labelInterestFree: string
    labelCreditor: string
    freqWeekly: string
    freqMonthly: string
    freqQuarterly: string
    freqAnnually: string
    goalTrigger: string
    goalChipRemoveAria: string
    goalSheetTitle: string
    goalClearBy: string
    goalPaying: string
    goalYouNeed: string
    goalFreqWeekly: string
    goalFreqMonthly: string
    goalFreqQuarterly: string
    goalFreqAnnually: string
    goalSuffixWeekly: string
    goalSuffixMonthly: string
    goalSuffixQuarterly: string
    goalSuffixAnnually: string
    goalPaymentsCount: (n: number) => string
    goalRemindCheckbox: string
    goalSetButton: string
    goalIncomeWarning: (pct: string) => string
    receivedViaLabel: string
    receivedViaCash: string
    receivedViaBank: string
    receivedViaCard: string
    receivedViaCrypto: string
    receivedViaGold: string
    receivedViaOther: string
  }

  addDebtPayment: {
    allCleared: string
    labelBalance: string
    labelDebt: string
    backDebtList: string
    paymentModeOneTime: string
    paymentModeRecurring: string
    labelRecurringFrequency: string
    labelDate: string
    labelAmountPaid: string
    placeholderAmount: string
    labelPaymentCurrency: string
    optionGoldGrams: string
    labelPaidVia: string
    labelNotes: string
    buttonSubmit: string
  }

  recurringDebt: {
    sheetTitle: string
    sheetDescription: string
    emptyNoBalances: string
    labelBalance: string
    labelAmount: string
    placeholderAmount: string
    labelFrequency: string
    labelNextDue: string
    labelPaidVia: string
    labelActive: string
    labelNotes: string
    buttonSubmit: string
  }

  reports: {
    pageTitle: string
    summaryHeading: (start: string, end: string) => string
    kpiTotalIn: string
    kpiTotalInHint: string
    kpiSentHome: string
    kpiTotalOut: string
    kpiNetSaved: string
    kpiBiggestPurchase: string
    kpiGoToPayment: string
    timesUsed: (n: number) => string
    downloadData: string
    copySummary: string
    howYouPay: string
    useSingular: string
    usePlural: string
    expenseFilterHeading: string
    expenseFilterAll: string
    expenseFilterDebtOnly: string
    expenseFilterExcludeDebt: string
    spendingPaceTitle: string
    avgDailySpend: string
    projectedTotal: string
    categoriesToWatch: string
    paceOnTrack: string
    paceWarning: string
    paceOver: string
    suggestedDailyLabel: string
    savingsSectionTitle: string
    savingsDeposits: string
    savingsWithdrawals: string
    savingsNet: string
    moneyFlowHint: string
    netWorthTitle: string
    netWorthHint: string
    netWorthGoldIncomplete: string
  }

  landing: {
    heroTitle: string
    heroSubtitle: string
    feature1: string
    feature2: string
    feature3: string
    ctaSignIn: string
    ctaSignUp: string
  }

  settings: {
    unsavedTitle: string
    unsavedBody: string
    pageTitle: string
    pageSubtitle: string
    footer: string
    securityTitle: string
    twoFaToggle: string
    twoFaToggleHint: string
    twoFaFooter: string

    biometricUseFace: string
    biometricUseFingerprint: string
    biometricHint: string
    biometricConflict: string
    biometricEnabledFor: (email: string) => string
    biometricConfirmReason: string
    appLockTitle: string
    appLockHint: string

    accountTitle: string
    accountSignedIn: (email: string) => string
    accountSignOut: string

    currencyTitle: string
    mainCurrencyLabel: string
    mainCurrencyHint: string
    secondaryToggle: string
    secondaryHint: string
    secondaryCurrencyLabel: string
    secondaryNone: string
    onlyMyCurrencies: string
    onlyMyCurrenciesDesc: string
    liveRates: string
    ratesRefreshed: string
    ratesNotRefreshed: string
    goldLabel: string
    currencyConverterTitle: string
    currencyConverterNoRate: string
    goldPriceUnavailable: string
    goldPriceDelayed: string
    ratesAttribution: string
    showMeAround: string
    showMeAroundDesc: string

    pageLinksIncomeTitle: string
    pageLinksIncomeDesc: string
    pageLinksIncomeLink: string
    pageLinksSavingsTitle: string
    pageLinksSavingsDesc: string
    pageLinksSavingsLink: string

    paymentMethodsTitle: string
    paymentMethodsAdd: string
    paymentMethodsRemoveConfirm: string

    aiTitle: string
    aiToggle: string
    aiToggleHint: string
    aiConnection: string
    aiConnectionSub: string
    aiReady: string
    aiNotSetUp: string
    aiModel: string
    aiFooter1: string
    aiFooter2: string

    dataTitle: string
    dataIntro: string
    dataDeviceOnlyNote: string
    dataExportExpenses: string
    dataExportExpensesHint: string
    dataDownload: string
    dataRestore: string
    dataStartFresh: string
    dataResetWarning: string
    dataConfirmReset: string
    dataCancelReset: string

    lookFeelTitle: string
    themeLabel: string
    themeDark: string
    themeLight: string
    themeSystem: string
    themeNameMidnight: string
    themeNameBright: string
    themeNamePaper: string
    themeNameMinimal: string
    themePickerHint: string
    showCents: string
    desktopApp: string
    appInstalled: string
    installDesktop: string
    /** Shown when Chrome has not fired install yet (engagement / HTTPS). */
    installAndroidHint: string
    /** Desktop browsers without install support. */
    installUnavailableBrowser: string

    languageLabel: string
    languageEn: string
    languageAr: string

    adminTitle: string
    adminSubtitle: string
    adminLink: string

    importSuccess: string
    importError: string

    hub: {
      sectionAccount: string
      sectionPreferences: string
      sectionDataTracking: string
      sectionMore: string
      sectionLegal: string
      profile: string
      profileSubtitle: string
      account: string
      accountSubtitle: string
      display: string
      displaySubtitle: string
      currency: string
      currencySubtitle: string
      sms: string
      smsSubtitle: string
      data: string
      dataSubtitle: string
      goals: string
      goalsSubtitle: string
      subscriptions: string
      subscriptionsSubtitle: string
      terms: string
      privacy: string
      feedback: string
      feedbackSubtitle: string
    }
    feedback: {
      typeBug: string
      typeFeature: string
      labelTitle: string
      placeholderTitle: string
      labelDescription: string
      placeholderDescription: string
      submit: string
      submitting: string
      successTitle: string
      successBody: string
    }
  }

  profile: {
    pageTitle: string
    editProfile: string
    changeAvatar: string
    labelName: string
    placeholderName: string
    labelEmail: string
    labelEmailAccount: string
    labelPhone: string
    placeholderPhone: string
    labelCountry: string
    placeholderCountry: string
    placeholderCountrySelect: string
    labelCity: string
    placeholderCity: string
    labelGender: string
    genderUnset: string
    genderMale: string
    genderFemale: string
    genderPreferNot: string
    /** Friendly copy when a read-only field has no value (e.g. country / city). */
    readOnlyFieldEmptyHint: string
    emptyField: string
    displayNameFallback: string
    discard: string
    saveChanges: string

    budgetTitle: string
    budgetEditLink: string
    budgetModeFixed: string
    budgetModePercent: string
    budgetRecurringIncome: (currency: string) => string
    budgetMonthStarts: string
    budgetSave: string

    setupStepIncome: string
    setupStepBudget: string
    setupStepPayment: string
    setupStepExpense: string
    setupStepSavings: string
    setupMsg0: string
    setupMsg1: string
    setupMsg3: string
    setupMsg5: string
    doIt: string

    accountTitle: string
    accountEmail: string
    accountMemberSince: string
    changePassword: string

    avatarModalTitle: string
    avatarTabPick: string
    avatarTabUpload: string
    avatarTabRemove: string
    avatarUploadPhoto: string
    avatarChooseDifferent: string
    avatarClickToUpload: string
    avatarClickToUploadHint: string
    avatarNoPhoto: string
    avatarRemoveDesc: string
    avatarUseThis: string
    avatarTooLarge: string
    avatarInvalidFormat: string

    onboardingTitle: string
    onboardingDoneBody: string
    onboardingProgressBody: string
    onboardingContinue: string
    onboardingSignInHint: string
    onboardingPctComplete: (pct: number) => string
    setupTitle: string
    setupComplete: string
    deleteAccountTitle: string
    deleteAccountBody: string
    deleteAccountButton: string
    deleteAccountConfirmTitle: string
    deleteAccountConfirmBody: string
    deleteAccountConfirmPrompt: string
    deleteAccountConfirmWord: string
    deleteAccountConfirmButton: string
    deleteAccountCancel: string
    deleteAccountInProgress: string
    deleteAccountError: string
    deleteAccountSuccessTitle: string
    deleteAccountSuccessBody: string
    deleteAccountSuccessButton: string

    photoTitle: string
    photoDesc: string
    removePhoto: string
  }

  budgetPlanner: {
    categoriesTitle: string
    addPlan: string
    newPlanName: string
    addCategory: string
    deletePlan: string
    subcategories: string
    addSubcategory: string
    totalIncome: string
    totalPlanned: string
    projectedSavings: string
    projectedSavingsLine: (amount: string, savingsRatePercent: number) => string
    /** Short label on budget planner rows that are savings allocation, not spending. */
    savingsAllocationBadge: string
    aiEvalTitle: string
    aiEvalLoading: string
    aiEvalError: string
    aiEvalStatusGood: string
    aiEvalStatusNeedsAdjustment: string
    aiEvalStatusUnrealistic: string
    aiEvalTipGood: string
    aiEvalTipTight: string
    aiEvalTipUnrealistic: string
    aiEvalExpandAria: string
    aiEvalSuggestionLabel: string
    aiChatTitle: string
    aiChatPlaceholder: string
    aiSend: string
    applySuggestion: string
    applied: string
    noPlansHint: string
    defaultPlanName: string
    newCategoryName: string
    iconPlaceholder: string
    amount: string
    delete: string
    expandCategory: string
    chooseCategoryTitle: string
    customCategoryOption: string
    addCustomCategory: string
    editCategoryName: string
    categoryNamePlaceholder: string
    subcategoryNamePlaceholder: string
    amountPlaceholder: string
    emojiPickerLabel: string
    categoriesEmptyTitle: string
    categoriesEmptyDesc: string
    categoryNameExample: string
    noPlansEmptyTitle: string
    noPlansEmptyDesc: string
    noPlansCreateFirst: string
    buddgyTagline: string
    buddgyBuilderOpening: string
    buddgyChatSubtitle: string
    buddgyBuilderBadge: string
  }

  auth: {
    closeSignIn: string
    signInLabel: string
    signUpLabel: string
    loadingSignIn: string
    loadingSignUp: string
    submitSignIn: string
    submitSignUp: string
    footerNewHere: string
    footerAlreadyHave: string

    labelEmail: string
    placeholderEmail: string
    labelPassword: string
    placeholderPassword: string
    forgotPassword: string
    labelConfirm: string
    placeholderConfirm: string

    forgotTitle: string
    forgotSubtitle: string
    forgotLabelEmail: string
    forgotSendCode: string
    forgotBackToSignIn: string

    recoveryVerifyTitle: string
    recoveryCodeSent: (email: string) => string

    verifyTitle: string
    verifyCodeSent: (email: string) => string
    verifying: string
    verifyConfirm: string
    verifySendNew: string
    verifySendNewCooldown: (s: number) => string
    verifyDifferentEmail: string

    signInInstead: string
    sendNewCode: string

    errorNetwork: string
    errorRateLimit: string
    errorBadPassword: string
    errorUnconfirmed: string
    errorOtpExpired: string
    errorFallback: string
    errorEmailInvalid: string
    errorMissingPassword: string
    errorPasswordShort: string
    errorPasswordMismatch: string
    errorAccountExists: string
    errorNoAccountForEmail: string
    errorPasswordWeakComposition: string
    errorSignUpGeneric: string
    errorEmailSendFailed: string
    errorOtpIncomplete: string
    passwordStrengthLabel: string
    passwordStrengthWeak: string
    passwordStrengthFair: string
    passwordStrengthGood: string
    passwordStrengthStrong: string
    passwordRuleLength: (n: number) => string
    passwordRuleLetter: string
    passwordRuleNumber: string
    twoFaVerifyTitle: string
    twoFaCodeSent: (email: string) => string
    emailAlreadyRegistered: string
    emailPendingVerification: string
    noAccountForEmail: string
    createAccountInstead: string
    resendCode: string
    continueWithGoogle: string
    continueWithApple: string
    orContinueWithEmail: string
    oauthUnavailable: string
    oauthFailed: string
    oauthCancelled: string
    oauthTapToCancel: string
    biometricSignInFace: string
    biometricSignInFingerprint: string
    oauthProviderDisabled: string
    sessionExpired: string
    rememberMe: string
    emailCheckInFlight: string
    showPassword: string
    hidePassword: string
    // Morph form (email-first)
    morphTitle: string
    welcomeBack: (email: string) => string
    createAccountFor: (email: string) => string
    backToEmail: string
    continueAriaLabel: string
    pendingVerificationTitle: string
    pendingVerificationHelp: string
    pendingContinueCta: string
    pendingUseDifferentEmail: string
    srEnterPasswordFor: (email: string) => string
    srCreateAccountFor: (email: string) => string
    srFinishVerifying: string
  }

  resetPassword: {
    title: string
    subtitle: string
    labelNew: string
    placeholderNew: string
    labelConfirm: string
    placeholderConfirm: string
    errorMinLength: (min: number) => string
    errorMismatch: string
    errorUpdateFailed: string
    errorLinkExpired: string
    errorLinkExpiredTitle: string
    errorSamePassword: string
    errorWeakPassword: string
    requestNewLink: string
    buttonSubmit: string
    successSignInPrompt: string
  }

  notifications: {
    title: string
    markAllRead: string
    emptyState: string
    budgetAlertTitle: (category: string) => string
    budgetAlertBodyOver: (pct: number, category: string) => string
    budgetAlertBodyUnder: (pct: number, category: string, remaining: number) => string
    debtReminderTitle: string
    debtReminderBody: (name: string) => string
    monthEndTitleLast: string
    monthEndTitleDays: (n: number) => string
    monthEndBodyLast: string
    monthEndBodyDays: (n: number) => string
    savingsNudgeTitle: string
    savingsNudgeBody: string
    recurringDueBody: (name: string, amount: number, currency: string) => string
    recurringTomorrowBody: (name: string, amount: number, currency: string) => string
    recurringConfirmPaid: string
    recurringSnooze: string
    /** Server-built copy for SMS-transaction OS push (localized per account). */
    push: {
      smsExpenseTitle: (amount: string, label: string | null) => string
      smsExpenseBody: (bank: string) => string
      smsIncomeTitle: (amount: string, label: string | null) => string
      smsIncomeBody: (bank: string) => string
      smsConfirmTitle: string
      smsConfirmBody: (amount: string, label: string | null) => string
      /** Auto-added but the currency was assumed — tap to confirm/correct. */
      smsCurrencyConfirmTitle: (amount: string) => string
      smsCurrencyConfirmBody: (label: string | null) => string
      /** Non-spend movement (ATM / transfer / FX) — not counted as spending. */
      smsMovementTitle: (amount: string, label: string | null) => string
      smsMovementBody: (kindLabel: string) => string
      /** Credit-card payoff. */
      smsCcPayoffTitle: (amount: string) => string
      smsCcPayoffBody: (bank: string) => string
      /** Subscription-linked charge. */
      smsSubscriptionTitle: (amount: string, label: string | null) => string
      smsSubscriptionBody: (brand: string) => string
      /** Salary matched to declared income (no duplicate added). */
      smsSalaryTitle: (amount: string) => string
      smsSalaryBody: string
      smsSalaryDiffersBody: string
    }
  }

  modals: {
    fabTitle: string
    fabVoiceExpense: string
    fabScanReceipt: string
    fabLongPressTip: string
    fabVoiceTip: string
    fabTileScan: string
    fabTileExpense: string
    fabTileIncome: string
    fabTileDebt: string
    fabTileSaving: string
    fabLogPurchase: string
    fabAddIncome: string
    fabAddPayment: string
    fabTrackDebt: string
    fabAskAi: string
    fabRequireAuth: string
    fabRequireAuthAi: string
    requireAuthBudgetSetup: string
    addPaymentTitle: string
    addPaymentLabelName: string
    addPaymentPlaceholderName: string
    addPaymentLabelType: string
    addPaymentLabelCurrency: string
    addPaymentLabelColor: string
    addPaymentLabelDefault: string
    addPaymentSubmit: string
  }

  ai: {
    headerTitle: string
    headerSubtitle: string
    composerPlaceholder: string
    sendMessage: string
    emptyIntro: string
    suggestion1: string
    suggestion2: string
    suggestion3: string
    suggestion4: string
    confirmAdd: string
    confirmEdit: string
    multiIntentHint: string
    confirmedLabel: string
    systemResting: string
    guardSignIn: string
    categoryLabel: string
    balancePaymentTo: string
    balanceExpenseNote: string
    percentOfIncome: string
  }

  pwa: {
    updateTitle: string
    updateSubtitle: string
    updateNotNow: string
    updateRefresh: string
    installTitle: string
    installSubtitle: string
    installButton: string
    installApp: string
    iosDialogTitle: string
    iosDialogDesc: string
    iosStep1: string
    iosStep2: string
    iosStep3: string
    iosStep4: string
  }

  onboarding: {
    lifestyleTitle: string
    lifestyleSubtitle: string
    lifestyleLabelFood: string
    lifestyleFoodEveryday: string
    lifestyleFoodMostdays: string
    lifestyleFoodSometimes: string
    lifestyleFoodRarely: string
    lifestyleLabelTransport: string
    lifestyleTransportPublic: string
    lifestyleTransportCar: string
    lifestyleTransportTaxi: string
    lifestyleTransportWalk: string
    lifestyleLabelTier: string
    lifestyleTierMinimal: string
    lifestyleTierBalanced: string
    lifestyleTierComfortable: string
    lifestyleSave: string
    householdTitle: string
    householdSubtitle: string
    householdLabelSize: string
    householdSolo: string
    householdCouple: string
    householdFamily: string
    householdLabelRent: string
    householdRentPlaceholder: string
    householdUtilitiesIncluded: string
    householdSave: string
  }


  budgetPreview: {
    pageTitle: string
    pageSubtitle: string
    sectionIncome: string
    sectionFixed: string
    sectionBudget: string
    sectionProjectedSavings: string
    fixedEmpty: string
    editPlan: string
    doneEditing: string
    regenerate: string
    regenerateHide: string
    regeneratePrompt: string
    regeneratePlaceholder: string
    regenerateSubmit: string
    regenerateCancel: string
    regenerating: string
    looksGood: string
    applying: string
    sourceAi: string
    sourcePreset: string
    feedbackSaveFailed: string
    aiFailed: string
    statedSavingsTarget: (amount: string) => string
  }

  categories: Record<string, string>

  paymentMethodTypes: {
    cash: string
    bank_account: string
    debit_card: string
    credit_card: string
    prepaid_card: string
    wallet: string
    bnpl: string
    other: string
  }

  /** Payment methods v4 wallet + setup sheet. */
  paymentMethods: {
    title: string
    addMethod: string
    default: string
    walletHint: string
    emptyHint: string
    edit: string
    delete: string
    setDefault: string
    addTitle: string
    editTitle: string
    newMethod: string
    cardColour: string
    popularOptions: string
    searchAll: string
    type: string
    identifier: string
    optional: string
    fourDigits: string
    label: string
    none: string
    last4Help: string
    tagPlaceholder: string
    currency: string
    setDefaultSub: string
    saveMethod: string
    chooseProvider: string
    searchProviderPlaceholder: string
    allProviders: string
    addCustom: string
    addCustomNamed: string
    savedCount: string
    manageSubtitle: string
    selectCard: string
    selectHint: string
    addNewMethod: string
    provider: string
    providerPlaceholder: string
  }

  goldPurity: {
    k24: string
    k22: string
    k21: string
    k18: string
  }

  profileDropdown: {
    yourProfile: string
    budgetSetup: string
    settings: string
    goals: string
    subscriptions: string
  }

  subscriptions: {
    pageTitle: string
    addSubscription: string
    totalMonthly: string
    perMonth: string
    perYear: string
    perWeek: string
    perQuarter: string
    renewsOn: string
    cancelledOn: string
    active: string
    cancelled: string
    paused: string
    trial: string
    searchPlaceholder: string
    customSubscription: string
    selectPlan: string
    adjustPriceHint: string
    priceEstimateNote: string
    billingCycle: string
    billingDay: string
    startedOn: string
    confirmCancel: string
    cancelSubscriptionAction: string
    cancelHint: string
    reactivate: string
    deleteSubscription: string
    confirmDeleteSubscription: string
    amountLabel: string
    serviceName: string
    billingWeekly: string
    billingMonthly: string
    billingQuarterly: string
    billingYearly: string
    profileSummary: (count: number, totalFormatted: string) => string
    emptyTitle: string
    emptyHint: string
    paymentMethod: string
    saveAdd: string
    saveEdit: string
    editSubscription: string
    manage: string
    activeSection: (n: number) => string
    cancelledSection: string
    catPopular: string
    catAiProductivity: string
    catStreaming: string
    catMusic: string
    catCloudStorage: string
    catGaming: string
    catVpn: string
    catFitness: string
    catReading: string
    catCommunication: string
    catTelecom: string
    catOther: string
    customSubscriptionHint: string
  }

  goals: {
    pageTitle: string
    addGoal: string
    editGoal: string
    emptyState: string
    emptyStateHint: string
    active: string
    achieved: string
    achievedSection: string
    paused: string
    targetAmount: string
    currentProgress: string
    monthlyContribution: string
    targetDate: string
    linkedAccounts: string
    linkedDebts: string
    monthsRemaining: string
    achievedOn: string
    seeAll: string
    dashboardEmpty: string
    profileSummaryLine: (active: number, achieved: number) => string
    nextMilestone: string
    manage: string
    category: string
    goalName: string
    currency: string
    monthlyLimit: string
    nextStep: string
    createAccountHint: string
    createAccountPlaceholder: string
    manualProgress: string
    manualProgressHint: string
    notes: string
    monthsOfExpenses: string
    debtRemaining: string
    thisMonth: string
    confirmDelete: string
    deleteGoal: string
    celebration: (name: string) => string
    categoryEmergencyFund: string
    categoryHouse: string
    categoryCar: string
    categoryVacation: string
    categoryEducation: string
    categoryWedding: string
    categoryPhoneDevice: string
    categoryFamilySupport: string
    categorySadaqahCharity: string
    categoryGift: string
    categoryInvestment: string
    categoryDebtFreedom: string
    categoryQualityOfLife: string
    categorySpendingControl: string
    categoryRetirement: string
    categoryCustom: string
  }

  pendingCaptures: {
    chip: (count: number) => string
    waitingOffline: (count: number) => string
    failed: string
    voiceEmpty: string
    buddgyOffline: string
  }

  pendingSms: {
    waiting: string
    generic: string
    more: (count: number) => string
  }

  smsReview: {
    chip: (count: number) => string
    title: string
    subtitle: string
    addTransaction: string
    confirmCurrencyBtn: (currency: string) => string
    confirmCurrencyHelp: string
    dismiss: string
    actionFailed: string
  }

  smsTracking: {
    sectionTitle: string
    sectionSubtitle: string
    toggleLabel: string
    toggleHint: string
    statusConnected: (bank: string, time: string) => string
    statusNeverConnected: string
    pendingQueued: (count: number) => string
    iosCardTitle: string
    iosStatusWaiting: string
    iosStatusConnected: (time: string) => string
    iosStepKeywordsTitle: string
    iosStepKeywordsDesc: string
    iosKeywordsYourCurrencies: string
    iosKeywordsCatchAlls: string
    iosKeywordsCatchAllsHint: string
    iosKeywordsPrivacy: string
    iosCopyKeywords: string
    iosCopiedKeywords: string
    iosStepOpenShortcutsTitle: string
    iosStepOpenShortcutsDesc: string
    iosOpenShortcutsButton: string
    iosStepAutomationTitle: string
    iosStepAutomationDesc: string
    iosStepActionTitle: string
    iosStepActionDesc: string
    iosRepeatPerCurrencyHint: string
    iosSetupButton: string
    iosSetupButtonConnected: string
    iosSetupPageTitle: string
    iosSetupDone: string
    androidCardTitle: string
    androidCardSubtitle: string
    androidApkTitle: string
    androidApkDesc: string
    androidApkButton: string
    androidApkStep1: string
    androidApkStep2: string
    androidManualTitle: string
    androidManualDesc: string
    androidWebhookLabel: string
    androidTokenLabel: string
    androidCopied: string
    supportedBanksTitle: string
    tokenRotateButton: string
    tokenRotateConfirm: string
    tokenRotateSuccess: string
    guide: {
      brand: string
      introBadge: string
      introTitle1: string
      introTitle2: string
      introBody: string
      heroBankName: string
      heroNow: string
      heroSmsPre: string
      heroSmsAmount: string
      heroSmsPost: string
      heroLoggedLabel: string
      heroAutoLogged: string
      heroMerchant: string
      heroCategory: string
      heroMethod: string
      trust: string
      cta: string
      ctaCaption: string
      setupTitle: string
      stepOf: (n: number, total: number) => string
      openShortcuts: string
      addKeyword: string
      finish: string
      automationActive: string
      copied: (word: string) => string
      kwHeaderTitle: string
      kwHeaderBody: string
      kwSentLabel: string
      kwEnPre: string
      kwEnHl: string
      kwEnPost: string
      kwArPre: string
      kwArHl: string
      kwArPost: string
      kwCommonLabel: string
      ariaClose: string
      ariaBack: string
      ariaPrev: string
      ariaNext: string
      ariaStep: (n: number) => string
      steps: { title: string; desc: string }[]
    }
  }

  ui: {
    select: {
      placeholder: string
      search: string
      empty: string
    }
    confirm: {
      confirm: string
      cancel: string
      destructiveConfirm: string
    }
    alert: {
      ok: string
    }
  }
}

export type Locale = 'en' | 'ar'
