import type { OnboardingGoal } from '@/lib/store/types'

/** Copy for the first-run journey and the Flow setup state. Money and dates arrive pre-formatted. */
export interface OnboardingCopy {
  skip: string
  back: string
  cont: string
  stepOf: (n: number, total: number) => string
  leaveTitle: string
  leaveBody: string
  leaveStay: string
  leaveGo: string
  about: {
    badge: string
    title: string
    nameLabel: string
    namePlaceholder: string
    countryLabel: string
    countries: { EG: string; AE: string; SA: string; OTHER: string }
    languageLabel: string
    currencyLine: (code: string, name: string) => string
    why: string
  }
  goals: { title: (name: string) => string; lead: string; options: Record<OnboardingGoal, string>; why: string }
  accounts: {
    title: string
    lead: string
    addCash: string
    addBank: string
    addWallet: string
    empty: string
    later: string
    why: string
    revealLabel: (n: number) => string
    revealChip: string
    revealTitle: (name: string) => string
    revealLead: string
  }
  income: {
    title: string
    lead: string
    amountLabel: string
    dayLabel: string
    otherDay: string
    steadyLabel: string
    steady: string
    varies: string
    variesNote: string
    why: string
    none: string
    salary: string
  }
  reveal: {
    label: string
    chip: (days: number) => string
    unit: (code: string) => string
    balance: string
    payday: string
    income: string
    title: (name: string) => string
    lead: string
    todayTitle: string
    todayLead: string
    nextTitle: string
    nextBody: string
  }
  automate: {
    title: string
    lead: string
    smsTitle: string
    smsSub: string
    smsExample: string
    becomes: string
    merchant: string
    category: string
    turnOn: string
    notNow: string
    pushTitle: string
    pushSub: string
    pushAllow: string
    done: string
    webNote: string
  }
  android: { title: string; bullets: [string, string, string]; note: string; cont: string; notNow: string }
  ios: { title: string; lead: string; steps: [string, string, string]; setup: string; later: string; remind: string }
  budget: {
    title: string
    lead: string
    startFrom: string
    income: (amount: string) => string
    accounts: (n: number) => string
    sample: string
    why: string
    build: string
    later: string
  }
  flow: {
    allSet: (name: string) => string
    perDay: (code: string) => string
    daysToPayday: (n: number) => string
    firstTitle: string
    firstBody: string
    addExpense: string
    bankTexts: string
    finish: string
    finishLeft: (done: number, total: number) => string
    resumeTitle: string
    welcomeBack: (name: string) => string
    stepLabel: (n: number, total: number) => string
    minute: string
    minutes: (n: number) => string
    continueSetup: string
    more: string
    accountsRow: { title: string; sub: string }
    smsRow: { title: string; sub: string }
    paydayRow: { title: string; sub: string }
    budgetRow: { title: string; sub: string }
    expenseRow: { title: string; sub: string }
  }
}

export const onboardingCopyEn: OnboardingCopy = {
  skip: 'Skip',
  back: 'Back',
  cont: 'Continue',
  stepOf: (n, total) => `Step ${n} of ${total}`,
  leaveTitle: 'Leave setup for now?',
  leaveBody: 'Everything you have added is saved. You can pick up again from Flow any time.',
  leaveStay: 'Keep going',
  leaveGo: 'Leave setup',
  about: {
    badge: 'About 2 minutes',
    title: "Hi, I'm Buddgy. What should I call you?",
    nameLabel: 'Your name',
    namePlaceholder: 'Your first name',
    countryLabel: 'Where do you live?',
    countries: { EG: 'Egypt', AE: 'UAE', SA: 'Saudi Arabia', OTHER: 'Other' },
    languageLabel: 'Language',
    currencyLine: (code, name) => `Currency ${code} · ${name}`,
    why: 'Your country sets your currency and the typical costs I plan with. You can change all of this later.',
  },
  goals: {
    title: (name) => `Nice to meet you, ${name}. What brings you here?`,
    lead: "Pick up to two. I'll start with what matters most.",
    options: {
      see: 'See where my money goes',
      runout: 'Stop running out before payday',
      save: 'Save for something',
      debt: 'Get out of debt',
      budget: 'Build a budget that fits my life',
    },
    why: 'This shapes what I show you first and how I build your budget later.',
  },
  accounts: {
    title: 'Where does your money live?',
    lead: "Add the places you keep money, with today's balance from your banking app. An estimate is fine.",
    addCash: 'Cash',
    addBank: 'Bank account',
    addWallet: 'Wallet',
    empty: 'Nothing added yet.',
    later: "I'll add balances later",
    why: 'These balances become your starting point. Bank messages keep them up to date later.',
    revealLabel: (n) => (n === 1 ? 'In 1 account' : `Across ${n} accounts`),
    revealChip: 'Starting point',
    revealTitle: (name) => `That's your starting point, ${name}.`,
    revealLead: "Next I'll add your income, so I can tell you what's safe to spend each day.",
  },
  income: {
    title: 'When does your money arrive?',
    lead: "Your salary or main income. I'll count the days to payday for you.",
    amountLabel: 'Take-home pay each month',
    dayLabel: 'Which day does it land?',
    otherDay: 'Other',
    steadyLabel: 'Is it the same every month?',
    steady: 'Steady',
    varies: 'It varies',
    variesNote: "If it varies, I'll plan on a quieter month, so good months are a bonus.",
    why: 'This becomes your first payday on the calendar. Nothing is shared with anyone.',
    none: "I don't have regular income",
    salary: 'Salary',
  },
  reveal: {
    label: 'You can spend about',
    chip: (n) => (n === 1 ? '1 day to payday' : `${n} days to payday`),
    unit: (code) => `${code} a day`,
    balance: 'Balance',
    payday: 'Payday',
    income: 'Income',
    title: (name) => `There it is, ${name}: your month in one number.`,
    lead: "That's your balance spread over the days until payday. It gets sharper once I know your bills.",
    todayTitle: "Payday is today, congratulations.",
    todayLead: "Once the money lands I'll show you what's safe to spend each day.",
    nextTitle: 'Next: let your messages do the typing',
    nextBody: 'Bank texts become transactions on their own, and this number stays true.',
  },
  automate: {
    title: 'Let your messages do the typing',
    lead: 'Two things make Buddget run itself. Both are optional, and you can turn them on later.',
    smsTitle: 'Bank text capture',
    smsSub: 'Every purchase logs itself',
    smsExample: 'CIB: EGP 245.00 spent at Carrefour. Available balance EGP 13,955.00',
    becomes: 'becomes',
    merchant: 'Carrefour',
    category: 'Groceries',
    turnOn: 'Turn on',
    notNow: 'Not now',
    pushTitle: 'Payday and bill reminders',
    pushSub: 'A nudge when it matters, never spam',
    pushAllow: 'Allow reminders',
    done: 'Done',
    webNote: 'Bank text capture and reminders are in the Buddget app for iPhone and Android.',
  },
  android: {
    title: 'Allow Buddget to read your bank texts',
    bullets: [
      'Only messages from banks and wallets are used. Personal chats are ignored.',
      'Each one becomes a transaction with its amount, merchant and balance.',
      'You can turn it off any time in Settings.',
    ],
    note: 'Android will ask for your permission next.',
    cont: 'Continue',
    notNow: 'Not now',
  },
  ios: {
    title: 'See it first. Set it up in two minutes, once.',
    lead: "On iPhone, one Shortcut passes your bank texts to Buddget. I'll walk you through it step by step.",
    steps: ['Bank text arrives', 'Shortcut runs by itself', 'Transaction appears'],
    setup: 'Set up now, about 2 minutes',
    later: 'Later',
    remind: "I'll offer it again after your first expense.",
  },
  budget: {
    title: 'Want me to build your budget now?',
    lead: "It takes about two minutes. I already know a lot from what you told me, so I'll only ask a few things.",
    startFrom: "I'll start from",
    income: (a) => `Income ${a}`,
    accounts: (n) => (n === 1 ? '1 account' : `${n} accounts`),
    sample: 'A sample of what your plan will look like',
    why: 'You review everything before it starts. Nothing changes until you say so.',
    build: 'Build my budget',
    later: 'Maybe later',
  },
  flow: {
    allSet: (name) => `You're all set, ${name}`,
    perDay: (code) => `${code} a day`,
    daysToPayday: (n) => (n === 1 ? '1 day to payday' : `${n} days to payday`),
    firstTitle: 'Your first expense is the next step',
    firstBody: 'Log one now and watch this number move.',
    addExpense: 'Add an expense',
    bankTexts: 'Bank texts',
    finish: 'Finish setting up',
    finishLeft: (done, total) => `${done} of ${total}`,
    resumeTitle: 'Pick up where you left off',
    welcomeBack: (name) => `Welcome back, ${name}.`,
    stepLabel: (n, total) => `Step ${n} of ${total}`,
    minute: 'About 1 minute',
    minutes: (n) => `About ${n} minutes`,
    continueSetup: 'Continue setup',
    more: 'More to set up',
    accountsRow: { title: 'Your accounts', sub: 'Bank, wallet and cash, so balances are real' },
    smsRow: { title: 'Bank text capture', sub: 'Purchases log themselves' },
    paydayRow: { title: 'Income and payday', sub: 'So I can count the days for you' },
    budgetRow: { title: 'Your budget', sub: 'About 2 minutes with Buddgy' },
    expenseRow: { title: 'Track your first expense', sub: 'Tap + any time' },
  },
}

export const onboardingCopyAr: OnboardingCopy = {
  skip: 'تخطَّ',
  back: 'رجوع',
  cont: 'متابعة',
  stepOf: (n, total) => `الخطوة ${n} من ${total}`,
  leaveTitle: 'تغادر الإعداد الآن؟',
  leaveBody: 'كل ما أضفته محفوظ. يمكنك المتابعة من صفحة التدفق في أي وقت.',
  leaveStay: 'أكمل',
  leaveGo: 'غادر الإعداد',
  about: {
    badge: 'حوالي دقيقتين',
    title: 'أهلًا، أنا Buddgy. ماذا أناديك؟',
    nameLabel: 'اسمك',
    namePlaceholder: 'اسمك الأول',
    countryLabel: 'أين تعيش؟',
    countries: { EG: 'مصر', AE: 'الإمارات', SA: 'السعودية', OTHER: 'أخرى' },
    languageLabel: 'اللغة',
    currencyLine: (code, name) => `العملة ${code} · ${name}`,
    why: 'بلدك يحدد عملتك وتكاليفك المعتادة التي أخطط بها. يمكنك تغيير كل هذا لاحقًا.',
  },
  goals: {
    title: (name) => `تشرفت بمعرفتك يا ${name}. ما الذي أتى بك؟`,
    lead: 'اختر اثنين على الأكثر. سأبدأ بالأهم.',
    options: {
      see: 'أرى أين تذهب أموالي',
      runout: 'ألا ينفد مالي قبل الراتب',
      save: 'أدخر لشيء ما',
      debt: 'أتخلص من الديون',
      budget: 'أبني ميزانية تناسب حياتي',
    },
    why: 'هذا يحدد ما أعرضه عليك أولًا وكيف أبني ميزانيتك لاحقًا.',
  },
  accounts: {
    title: 'أين يوجد مالك؟',
    lead: 'أضف الأماكن التي تحتفظ فيها بالمال مع رصيد اليوم من تطبيق البنك. التقدير كافٍ.',
    addCash: 'نقد',
    addBank: 'حساب بنكي',
    addWallet: 'محفظة',
    empty: 'لم تُضف شيئًا بعد.',
    later: 'سأضيف الأرصدة لاحقًا',
    why: 'هذه الأرصدة هي نقطة البداية. رسائل البنك تُبقيها محدّثة لاحقًا.',
    revealLabel: (n) => (n === 1 ? 'في حساب واحد' : `عبر ${n} حسابات`),
    revealChip: 'نقطة البداية',
    revealTitle: (name) => `هذه نقطة بدايتك يا ${name}.`,
    revealLead: 'سأضيف الآن دخلك لأخبرك بما يمكنك إنفاقه بأمان كل يوم.',
  },
  income: {
    title: 'متى يصلك المال؟',
    lead: 'راتبك أو دخلك الرئيسي. سأعدّ لك الأيام حتى الراتب.',
    amountLabel: 'الصافي الذي تتسلمه شهريًا',
    dayLabel: 'في أي يوم يصل؟',
    otherDay: 'يوم آخر',
    steadyLabel: 'هل هو ثابت كل شهر؟',
    steady: 'ثابت',
    varies: 'يتغير',
    variesNote: 'إن كان يتغير فسأخطط على شهر أضعف، فتصبح الشهور الجيدة مكسبًا.',
    why: 'يصبح هذا أول يوم راتب في تقويمك. لا يُشارك مع أحد.',
    none: 'ليس لدي دخل منتظم',
    salary: 'الراتب',
  },
  reveal: {
    label: 'يمكنك إنفاق نحو',
    chip: (n) => (n === 1 ? 'يوم واحد حتى الراتب' : `${n} يومًا حتى الراتب`),
    unit: (code) => `${code} في اليوم`,
    balance: 'الرصيد',
    payday: 'الراتب',
    income: 'الدخل',
    title: (name) => `ها هو يا ${name}: شهرك في رقم واحد.`,
    lead: 'هذا رصيدك موزعًا على الأيام حتى الراتب. يصبح أدق عندما أعرف فواتيرك.',
    todayTitle: 'اليوم يوم الراتب، مبارك.',
    todayLead: 'عندما يصل المال سأريك ما يمكنك إنفاقه بأمان كل يوم.',
    nextTitle: 'التالي: دع رسائلك تكتب عنك',
    nextBody: 'رسائل البنك تتحول إلى معاملات تلقائيًا، ويبقى هذا الرقم صحيحًا.',
  },
  automate: {
    title: 'دع رسائلك تكتب عنك',
    lead: 'شيئان يجعلان Buddget يعمل وحده. كلاهما اختياري ويمكنك تفعيلهما لاحقًا.',
    smsTitle: 'التقاط رسائل البنك',
    smsSub: 'كل عملية شراء تُسجَّل وحدها',
    smsExample: 'CIB: EGP 245.00 spent at Carrefour. Available balance EGP 13,955.00',
    becomes: 'تتحول إلى',
    merchant: 'كارفور',
    category: 'البقالة',
    turnOn: 'فعّل',
    notNow: 'ليس الآن',
    pushTitle: 'تذكير الراتب والفواتير',
    pushSub: 'تنبيه عندما يهم، بلا إزعاج',
    pushAllow: 'اسمح بالتذكيرات',
    done: 'تم',
    webNote: 'التقاط رسائل البنك والتذكيرات متوفران في تطبيق Buddget للآيفون والأندرويد.',
  },
  android: {
    title: 'اسمح لـ Buddget بقراءة رسائل البنك',
    bullets: [
      'تُستخدم رسائل البنوك والمحافظ فقط. المحادثات الشخصية تُتجاهل.',
      'كل رسالة تصبح معاملة بمبلغها والتاجر والرصيد.',
      'يمكنك إيقافها في أي وقت من الإعدادات.',
    ],
    note: 'سيطلب منك أندرويد الإذن بعد ذلك.',
    cont: 'متابعة',
    notNow: 'ليس الآن',
  },
  ios: {
    title: 'شاهدها أولًا. أعدّها في دقيقتين، مرة واحدة.',
    lead: 'على الآيفون يمرر اختصار واحد رسائل البنك إلى Buddget. سأرافقك خطوة بخطوة.',
    steps: ['تصل رسالة البنك', 'يعمل الاختصار وحده', 'تظهر المعاملة'],
    setup: 'أعدّها الآن، نحو دقيقتين',
    later: 'لاحقًا',
    remind: 'سأعرضها عليك مجددًا بعد أول مصروف.',
  },
  budget: {
    title: 'هل أبني ميزانيتك الآن؟',
    lead: 'تستغرق نحو دقيقتين. أعرف الكثير مما أخبرتني به، فسأسألك عن القليل فقط.',
    startFrom: 'سأبدأ من',
    income: (a) => `الدخل ${a}`,
    accounts: (n) => (n === 1 ? 'حساب واحد' : `${n} حسابات`),
    sample: 'نموذج لما ستبدو عليه خطتك',
    why: 'تراجع كل شيء قبل أن يبدأ. لا يتغير شيء حتى توافق.',
    build: 'ابنِ ميزانيتي',
    later: 'ربما لاحقًا',
  },
  flow: {
    allSet: (name) => `كل شيء جاهز يا ${name}`,
    perDay: (code) => `${code} في اليوم`,
    daysToPayday: (n) => (n === 1 ? 'يوم واحد حتى الراتب' : `${n} يومًا حتى الراتب`),
    firstTitle: 'أول مصروف هو الخطوة التالية',
    firstBody: 'سجّل واحدًا الآن وشاهد هذا الرقم يتحرك.',
    addExpense: 'أضف مصروفًا',
    bankTexts: 'رسائل البنك',
    finish: 'أكمل الإعداد',
    finishLeft: (done, total) => `${done} من ${total}`,
    resumeTitle: 'أكمل من حيث توقفت',
    welcomeBack: (name) => `أهلًا بعودتك يا ${name}.`,
    stepLabel: (n, total) => `الخطوة ${n} من ${total}`,
    minute: 'نحو دقيقة',
    minutes: (n) => `نحو ${n} دقائق`,
    continueSetup: 'أكمل الإعداد',
    more: 'المزيد للإعداد',
    accountsRow: { title: 'حساباتك', sub: 'البنك والمحفظة والنقد لتكون الأرصدة حقيقية' },
    smsRow: { title: 'التقاط رسائل البنك', sub: 'المشتريات تُسجَّل وحدها' },
    paydayRow: { title: 'الدخل والراتب', sub: 'لأعدّ لك الأيام' },
    budgetRow: { title: 'ميزانيتك', sub: 'نحو دقيقتين مع Buddgy' },
    expenseRow: { title: 'تتبّع أول مصروف', sub: 'اضغط + في أي وقت' },
  },
}
