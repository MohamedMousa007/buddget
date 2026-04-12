/** Buddget i18n dictionary shape — every key in ar.ts must match en.ts exactly. */

export interface Dictionary {
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
  }

  nav: {
    dashboard: string
    budgetSetup: string
    expenses: string
    income: string
    savings: string
    debts: string
    reports: string
    home: string
    more: string
    quickAdd: string
    profileMenu: string
  }

  brand: {
    tagline: string
    footerVersion: string
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
    incomeBlockedHint: string
    budgetUsedLabel: string
    statusOverBudget: string
    statusCloseToBudget: string
    statusWithinBudget: string
    remainingSuffix: string
    overBudgetSuffix: string
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
    labelRepeats: string
    labelNotes: string
    placeholderNotes: string
    buttonSubmit: string
    buttonSave: string
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
    labelCurrency: string
    buttonAdd: string
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
    debtTypeLabel: string
    debtTypePersonal: string
    debtTypeInstallment: string
    debtTypeGeneral: string
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
  }

  settings: {
    pageTitle: string
    pageSubtitle: string
    footer: string

    guestTitle: string
    guestBody: string
    guestCta: string
    guestSignIn: string

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

    setupTitle: string
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

    onboardingTitle: string
    onboardingDoneBody: string
    onboardingProgressBody: string
    onboardingContinue: string
    onboardingSignInHint: string
    onboardingPctComplete: (pct: number) => string

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
    projectedSavingsLine: (amount: string) => string
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
    buddgyHeroTitleMeet: string
    buddgyHeroSubtitle: string
    buddgyHeroBody: string
    buddgyHeroCta: string
    buddgyHeroManualHint: string
    buddgyCompactTitle: string
    buddgyCompactBody: string
    buddgyCompactCta: string
    buddgyBuilderOpening: string
    buddgyChatSubtitle: string
    buddgyBuilderBadge: string
    buddgyEvalSectionTitle: string
  }

  sharedBudget: {
    membersTitle: string
    you: string
    roleOwner: string
    roleManager: string
    roleViewer: string
    syncOn: string
    setAsDefaultPlan: string
    addPartner: string
    previewPlan: string
    accept: string
    decline: string
    inviteTitle: string
    inviteEmail: string
    inviteEmailPlaceholder: string
    roleView: string
    roleManage: string
    syncLabel: string
    syncHelp: string
    sendInvite: string
    notFoundHint: string
    inviteApp: string
    foundAs: string
    closeSheet: string
    planSwitcherPersonal: string
    planSwitcherCreateShared: string
    defaultBadge: string
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
    errorSignUpGeneric: string
    errorOtpIncomplete: string
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
    plansLoadError: string
    continueWithoutPlanBusy: string
    continueWithoutPlan: string
    loadingMessage: string
    bannerTagline: string
    bannerDismiss: string
    bannerCta: string

    continueButton: string
    planLoading: string
    finishing: string
    lastStep: string

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
  }
}

export type Locale = 'en' | 'ar'
