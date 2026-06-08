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
    cancel: string
    delete: string
    edit: string
    back: string
    close: string
    /** Walkthrough / tutorial primary action */
    next: string
    confirm: string
    remove: string
    loading: string
    unknown: string
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
    confirmDelete: string
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
    pageTitle: string
    pageSubtitle: string
    footer: string
    securityTitle: string
    twoFaToggle: string
    twoFaToggleHint: string
    twoFaFooter: string

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
    resetLinkSent: string

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
    forgotSuccess: string
    forgotLabelEmail: string
    forgotSendLink: string
    forgotBackToSignIn: string

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
  }

  modals: {
    fabTitle: string
    fabVoiceExpense: string
    fabScanReceipt: string
    fabLongPressTip: string
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
    pageTitle: string
    subtitlePlans: string
    subtitleRedo: string
    subtitleDefault: string
    skipButton: string
    backToProfile: string
    backStep: string
    stepOfTotal: (current: number, total: number) => string
    plansLoadError: string
    continueWithoutPlanBusy: string
    continueWithoutPlan: string
    loadingMessage: string
    bannerTagline: string
    bannerDismiss: string
    bannerCta: string
    bannerRemindLater: string
    bannerRemindLaterConfirm: string
    bannerFinishShort: string

    continueButton: string
    planLoading: string
    finishing: string
    lastStep: string

    preview: {
      subtitle: string
      presetBlurb: string
      feedbackLabel: string
      feedbackPlaceholder: string
      regenerate: string
      regenerating: string
      sourceAi: string
      sourcePreset: string
      continueCta: string
      applying: string
      monthlyIncome: (amount: string, currency: string) => string
      feedbackSaveFailed: string
      aiFailed: string
    }

    // Progressive-onboarding core gate (4 essentials).
    coreGateTitle: string
    coreGateSubtitle: string
    coreGateStepName: string
    coreGateStepNameHelp: string
    coreGateStepNamePlaceholder: string
    coreGateStepCountry: string
    coreGateStepCountryHelp: string
    coreGateStepCity: string
    coreGateStepCityHelp: string
    coreGateStepCityPlaceholder: string
    coreGateStepCurrency: string
    coreGateStepCurrencyHelp: string
    coreGateNextCta: string
    coreGateFinishCta: string
    coreGateFinishingCta: string

    // Journey (flow v3) — AI-driven onboarding. Keys live under a nested
    // `journey` sub-namespace so the new strings don't intermix with the
    // legacy Core Gate keys during the A/B period.
    journey: {
      common: {
        next: string
        back: string
        skip: string
        finish: string
      }
      welcome: {
        intro: { title: string; body: string }
        fork: {
          hint: string
          guidedLabel: string
          guidedDescription: string
          quickLabel: string
          quickDescription: string
        }
      }
      identity: {
        intro: { title: string; body: string }
        name: { placeholder: string }
        country: { hint: string }
        city: { hint: string; placeholder: string }
        currency: { hint: string }
        secondaryCurrency: { hint: string; noneLabel: string }
        household: {
          hint: string
          soloLabel: string
          coupleLabel: string
          familyLabel: string
        }
      }
      /**
       * Legacy scripted onboarding dialogue (keyed by card id and locale variant).
       * Slot tokens in templates (`{name}`, `{currency}`, …) are interpolated at runtime.
       */
      buddgy: {
        welcomeIntro: { default: string }
        identityName: { default: string }
        identityCountry: { default: string }
        identityCity: {
          default: string
          uae: string
          egypt: string
          saudi: string
          jordan: string
        }
        identityCurrency: { default: string }
        identitySecondaryCurrency: {
          default: string
          remittance: string
        }
        identityHousehold: { default: string }
        moneyInPmIntro: { default: string }
        moneyInIncomeIntro: {
          default: string
          afterPm: string
        }
        gateSavings: { default: string }
        gateDebts: { default: string }
        gateSubscriptions: { default: string }
        goalsIntro: { default: string }
        generateIntro: { default: string }
      }
      moneyIn: {
        pmIntro: { title: string; body: string }
      }
      /** Copy rendered by `OnboardingModalGate` (the Add another /
       *  Continue / summary chrome around a reused app modal). */
      modalGate: {
        emptyHint: string
        savedSummary: (count: number, lastName: string) => string
        addFirst: string
        addAnother: string
        continue: string
      }
      /** Copy for the terminal plan-building loading state (SP5). */
      loading: {
        placeholder: string
        title: string
        bullets: {
          income: string
          debts: string
          anchors: (country: string) => string
          drafting: string
        }
        softTimeout: string
        failed: string
        retry: string
      }
      multi: {
        add: {
          paymentMethods: string
          incomeSources: string
          debts: string
          subscriptions: string
          savingsAccounts: string
          goals: string
        }
        empty: {
          paymentMethods: string
          incomeSources: string
          debts: string
          subscriptions: string
          savingsAccounts: string
          goals: string
        }
      }
      pmTypes: {
        cash: string
        bank_transfer: string
        card_debit: string
        card_credit: string
        other: string
      }
      freq: {
        monthly: string
        biweekly: string
        weekly: string
      }
      pmEditor: {
        nameLabel: string
        namePlaceholder: string
        typeLabel: string
        currencyLabel: string
        defaultCheck: string
        openingOwedLabel: string
        openingOwedHint: string
      }
      incomeEditor: {
        nameLabel: string
        namePlaceholder: string
        amountLabel: string
        currencyLabel: string
        recurringLabel: string
        frequencyLabel: string
        paymentMethodLabel: string
        paymentMethodHint: string
      }
    }

    // First-run checklist shown on the dashboard until the user finishes setup.
    checklistTitle: string
    checklistProgress: (done: number, total: number) => string
    checklistItemIncome: string
    checklistItemBudget: string
    checklistItemDebts: string
    checklistItemPayments: string
    checklistDisabledBudget: string
    checklistOptOutDebts: string
    checklistHideCta: string
    checklistEmptyHint: string
    checklistCompleteToast: string
    checklistResumeCta: string
    checklistAddedAgain: (count: number) => string
    checklistTapToAddMore: string
    toastPaymentAdded: string

    // Expanded checklist (goals / lifestyle / household) + new sheets.
    checklistItemGoals: string
    checklistItemLifestyle: string
    checklistItemHousehold: string
    checklistOptOutGoals: string
    toastLifestyleSaved: string
    toastHouseholdSaved: string
    toastGoalAdded: string
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

    // Build-My-Budget CTA + post-build feedback.
    buildBudgetCta: string
    buildBudgetPendingCta: string
    buildBudgetHint: string
    buildBudgetSuccessToast: string
    buildBudgetFallbackToast: string
    buildBudgetErrorToast: string

    planPickerSection: string
    planPickerFooter: string
    planPickerPlaceholderNoIncome: string
    planPickerAmountLabel: (currency: string) => string
    planPickerPlanIndex: (current: number, total: number) => string
    planPickerMonthlyTakeHome: string
    planPickerPrevious: string
    planPickerNext: string
    planPickerAcceptBusy: string
    planPickerAccept: string

    paymentNickPlaceholder: string
    paymentCustomPlaceholder: string
    paymentRemove: string
    paymentAddCustom: string

    surveyLoadError: (error: string) => string

    welcomeTitle: string
    welcomeSubtitle: string
    welcomeBody: string
    welcomeHelp: string

    displayNameTitle: string
    displayNamePlaceholder: string
    displayNameHelp: string

    countryTitle: string
    countryPlaceholder: string
    countryHelp: string

    cityTitle: string
    cityPlaceholder: string
    cityHelp: string

    genderTitle: string
    genderHelp: string
    genderMale: string
    genderFemale: string
    genderPreferNot: string

    livingTitle: string
    livingHelp: string
    livingRentAlone: string
    livingRentShared: string
    livingMortgage: string
    livingOwner: string
    livingFamily: string
    livingOther: string

    relationshipTitle: string
    relationshipSingle: string
    relationshipPartner: string
    relationshipPreferNot: string

    dependentsTitle: string
    dependentsNone: string
    dependentsOne: string
    dependentsTwo: string
    dependentsThreeMore: string

    employmentTitle: string
    employmentSalaried: string
    employmentSelfEmployed: string
    employmentGig: string
    employmentStudent: string
    employmentNotWorking: string
    employmentRetired: string

    baseCurrencyTitle: string
    baseCurrencyHelp: string
    currencyAed: string
    currencyUsd: string
    currencyEgp: string
    currencyEur: string
    currencyGbp: string
    currencySar: string

    secondaryCurrencyTitle: string
    secondaryCurrencyHelp: string
    secondaryCurrencyNone: string

    incomeRegularityTitle: string
    incomeStable: string
    incomeVariable: string
    incomeIrregular: string
    incomeLittle: string

    incomeEntriesTitle: string
    incomeEntriesHelp: string

    housingTitle: string
    housingPlaceholder: string
    housingHelp: string

    debtSituationTitle: string
    debtNone: string
    debtSome: string
    debtQuiteBit: string
    debtPreferNot: string

    debtEntriesTitle: string
    debtEntriesHelp: string

    goalsTitle: string
    goalsHelp: string
    goalEmergency: string
    goalDebt: string
    goalCar: string
    goalTravel: string
    goalInvest: string
    goalHome: string
    goalEducation: string
    goalFamily: string
    goalStable: string

    priorityTitle: string
    prioritySave: string
    priorityDebt: string
    priorityStress: string
    priorityEnjoy: string

    spendingTitle: string
    spendingFrugal: string
    spendingBalanced: string
    spendingComfortable: string
    spendingImpulsive: string

    transportTitle: string
    transportCar: string
    transportPublic: string
    transportRideHail: string
    transportWalkBike: string
    transportMixed: string

    foodTitle: string
    foodCookHome: string
    foodMix: string
    foodEatOut: string

    subscriptionsTitle: string
    subscriptionsHelp: string

    goalsDetailTitle: string
    goalsDetailHelp: string
    savingsDetailTitle: string
    savingsDetailHelp: string

    savingsOrientationTitle: string
    savingsAlready: string
    savingsWantToStart: string
    savingsHardToSave: string

    paymentMethodsTitle: string
    paymentMethodsSubtitle: string
    paymentMethodsHelp: string
    paymentCash: string
    paymentDebit: string
    paymentCredit: string
    paymentBankTransfer: string
    paymentTransit: string
    paymentOther: string

    prePlanTitle: string
    prePlanBody: string
    prePlanHelp: string

    stackProfileTitle: string
    stackProfileSubtitle: string
    stackProfileHelp: string
    stackLifeMoneyTitle: string
    stackLifeMoneySubtitle: string
    stackLifeMoneyHelp: string
    stackHousingDebtTitle: string
    stackHousingDebtSubtitle: string
    stackHousingDebtHelp: string
    goalsCombinedTitle: string
    goalsCombinedSubtitle: string
    goalsCombinedHelp: string
    dualLiveTitle: string
    dualLiveSubtitle: string
    dualLiveHelp: string
    stackLifestyleTitle: string
    stackLifestyleSubtitle: string
    stackLifestyleHelp: string

    incomeIntro: string
    incomeRemove: string
    incomeSourceName: string
    incomeSourcePlaceholder: string
    incomeAmountLabel: string
    incomeAmountPlaceholder: string
    incomeCurrency: string
    incomeIsRecurring: string
    incomePayFrequency: string
    incomeDayOfMonth: string
    incomeNotes: string
    incomeAddButton: string

    debtIntro: string
    debtRemove: string
    debtNameLabel: string
    debtNamePlaceholder: string
    debtPersonLabel: string
    debtPersonPlaceholder: string
    debtDescLabel: string
    debtIsGold: string
    debtAmountGrams: string
    debtAmountLabel: string
    debtAmountPlaceholder: string
    debtCurrency: string
    debtKarat: string
    debtNotes: string
    debtAddButton: string

    subscriptionIntro: string
    subscriptionMonthlyCost: string
    subscriptionCurrency: string
    subscriptionCustomPlaceholder: string
    subscriptionAmountPlaceholder: string
    subscriptionAddAnother: string
    subscriptionTotal: (amount: string) => string

    freqMonthly: string
    freqMonthlyHint: string
    freqBiweekly: string
    freqBiweeklyHint: string
    freqWeekly: string
    freqWeeklyHint: string

    stagePersonal: string
    stagePersonalDesc: string
    stageIncome: string
    stageIncomeDesc: string
    stageCosts: string
    stageCostsDesc: string
    stageDebts: string
    stageDebtsDesc: string
    stageLifestyle: string
    stageLifestyleDesc: string
    stagePayments: string
    stagePaymentsDesc: string
    stagePlan: string
    stagePlanDesc: string

    personaSteadyLabel: string
    personaSteadyTagline: string
    personaGoalLabel: string
    personaGoalTagline: string
    personaEssentialistLabel: string
    personaEssentialistTagline: string
    personaSocialLabel: string
    personaSocialTagline: string
    personaDebtLabel: string
    personaDebtTagline: string
    personaInvestorLabel: string
    personaInvestorTagline: string
    personaFamilyLabel: string
    personaFamilyTagline: string
    personaFlexLabel: string
    personaFlexTagline: string

    subscriptionNetflix: string
    subscriptionSpotify: string
    subscriptionIcloud: string
    subscriptionYoutube: string
    subscriptionDisney: string
    subscriptionGym: string
    subscriptionSports: string
    subscriptionGaming: string

    // Active onboarding flow keys (v2+)
    nameLabel: string
    namePlaceholder: string
    countryLabel: string
    currencyDetected: (currency: string) => string
    currencyChange: string
    addSecondaryCurrency: string
    secondaryCurrencySelected: (currency: string) => string
    secondaryCurrencyHint: string
    secondaryCurrencyRemove: string

    incomeTitle: string
    incomeSubtitle: string
    incomeTypeLabel: string
    incomeTypes: { salary: string; freelance: string; business: string; other: string }

    skipForNow: string
    backButton: string

    // Step 2 — goals
    goalsSubtitle: string
    goalLabels: {
      emergency_fund: string
      pay_debt: string
      big_purchase: string
      investments: string
      daily_tracking: string
      reduce_expenses: string
    }

    // Step 3 — spending profile
    spendingProfileTitle: string
    spendingProfileSubtitle: string
    incomeRangeLabel: string
    incomeRangeLabels: {
      under_1k: string
      '1k_3k': string
      '3k_7k': string
      '7k_15k': string
      '15k_plus': string
    }
    moneyManagementLabel: string
    moneyManagementLabels: {
      spreadsheet: string
      another_app: string
      in_my_head: string
      dont_track: string
    }
    categoriesLabel: string
    categoryLabels: {
      food: string
      transport: string
      housing: string
      health: string
      entertainment: string
      shopping: string
      travel: string
      education: string
    }
    smsTrackingLabel: string
    smsTrackingHint: string

    // Step 5 — review
    reviewTitle: string
    reviewSubtitle: string
    reviewSectionIdentity: string
    reviewSectionGoals: string
    reviewSectionSpending: string
    reviewSectionIncome: string
    reviewNoneSelected: string
    reviewSkipped: string
    reviewFinishButton: string

    checklistIncomePrompt: string
    checklistBudgetPrompt: string
    checklistLiteModeNote: string
    checklistDismiss: string
  }

  onboardingV2: {
    welcomeIntro: string
    nameQuestion: string
    namePlaceholder: string
    countryHint: string
    countryPlaceholder: string
    incomeIntro: string
    incomeSourcePlaceholder: string
    amountPlaceholder: string
    addIncomeRow: string
    fixedIntro: string
    subscriptionsIntro: string
    subscriptionAmounts: string
    payIntro: string
    customPayLines: string
    customPayPlaceholder: string
    savingsIntro: string
    monthOptional: string
    savingsSkipHint: string
    debtsQuestion: string
    yes: string
    no: string
    personaIntro: string
    personaBalancedTitle: string
    personaBalancedBody: string
    personaSaverTitle: string
    personaSaverBody: string
    personaTrackTitle: string
    personaTrackBody: string
    reviewIntro: string
    reviewName: string
    reviewCountry: string
    reviewIncome: string
    reviewFixed: string
    reviewSubs: string
    reviewPay: string
    reviewSavings: string
    reviewDebts: string
    reviewStyle: string
    reviewEditHint: string
    editStep: (stepNumber: number) => string
    titleWelcome: string
    titleCountry: string
    titleIncome: string
    titleFixed: string
    titleSubs: string
    titlePay: string
    titleSavings: string
    titleDebts: string
    titleStyle: string
    titleReview: string
    looksGood: string
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
    bank_transfer: string
    card_debit: string
    card_credit: string
    nol: string
    other: string
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

  smsTracking: {
    sectionTitle: string
    sectionSubtitle: string
    toggleLabel: string
    toggleHint: string
    statusConnected: (bank: string, time: string) => string
    statusNeverConnected: string
    iosCardTitle: string
    iosCardSubtitle: string
    iosCardStep1: string
    iosCardStep2: string
    iosCardStep3: string
    iosCardStep4: string
    iosDownloadButton: string
    iosDownloading: string
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
    recentTitle: string
    recentEmpty: string
    recentUndo: string
    recentUndoSuccess: string
    recentUndoExpired: string
    recentViewExpense: string
    failure: {
      gemini_error: string
      not_transaction: string
      null_amount: string
      low_confidence: string
      duplicate: string
      log_insert_failed: string
      parse_exception: string
      unknown: string
    }
    supportedBanksTitle: string
    tokenRotateButton: string
    tokenRotateConfirm: string
    tokenRotateSuccess: string
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
