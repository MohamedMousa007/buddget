import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { GroupId, SettingId } from '@/lib/settings/registry'

export interface SettingItemCopy {
  label: string
  /** Extra search words in both languages; the label is always searched too. */
  keywords: string
  /** Phrases that should put this setting first (“currency” → main currency, not the converter). */
  exact?: string[]
}

export interface SettingsHubCopy {
  title: string
  searchLabel: string
  searchPlaceholder: string
  clearSearch: string
  close: string
  back: string
  footer: string
  recent: string
  suggestions: string
  suggestionList: string[]
  groupName: Record<GroupId, string>
  search: { noResults: (q: string) => string; noResultsHint: string; reportMissing: string; open: string; hint: string }
  profileHint: string
  quickTitle: string
  language: string
  theme: string
  themeLight: string
  themeDark: string
  currencyTile: string
  convertTile: string
  convertHint: string
  convertTitle: string
  showCents: string
  security: { title: string; subtitle: string; signIn: string; account: string; memberSince: string }
  devices: {
    title: string
    hint: string
    thisDevice: string
    collecting: string
    lastText: (when: string) => string
    noTextYet: string
    activeAgo: (when: string) => string
    notifyHere: string
    notifyHint: string
    mainBadge: string
    makeMain: string
    mainNote: string
    blockedHere: string
    pending: string
    loadFailed: string
    retry: string
    stale: (when: string) => string
    removeTitle: (name: string) => string
    removeBody: string
    remove: string
    removeFailed: string
    saveFailed: string
    empty: string
    alsoNotifyTitle: string
    alsoNotifyBody: (names: string) => string
    alsoNotifyYes: string
    alsoNotifyNo: string
    keptQuiet: string
  }
  sms: { title: string; hint: string; iosHint: string; on: string; off: string; guide: string }
  ai: { title: string; tipsHint: string; learningHint: string; memoryHint: string; voiceHint: string; deviceOnly: string }
  notif: { title: string; master: string; on: string; off: string; blocked: string; unsupported: string; pushHint: string; subs: string; goals: string; dueHint: string; priceHint: string; progressHint: string; behindHint: string }
  data: {
    title: string
    export: string
    exportHint: string
    csv: string
    csvHint: string
    backup: string
    backupHint: string
    import: string
    importHint: string
    syncedNote: string
    deleteCta: string
    deleteHint: string
  }
  help: {
    title: string
    feedback: string
    feedbackHint: string
    bug: string
    idea: string
    question: string
    inbox: string
    board: string
    boardHint: string
    boardEmpty: string
    boardState: Record<string, string>
    upvote: string
    downvote: string
    inboxHint: string
    inboxEmpty: string
    reply: string
    replyHint: string
    youLabel: string
    status: Record<string, string>
    terms: string
    privacy: string
    about: string
    aboutHint: string
    version: string
    story: string[]
    web: string
    contact: string
    madeWith: string
  }
  memory: {
    title: string
    intro: string
    household: string
    householdEmpty: string
    rent: string
    lifestyle: string
    budget: string
    entry: string
    entryAmount: string
    entryPercent: string
    weekStart: string
    weekSat: string
    weekSun: string
    weekMon: string
    gold: string
    goldHint: string
    learned: string
    learnedEmpty: string
    forget: string
    onboarding: string
    onboardingEmpty: string
    edit: string
    source: Record<'chat' | 'manual' | 'budget' | 'onboarding', string>
  }
  items: Record<SettingId, SettingItemCopy>
  notCounted: { subtitle: string; intro: string; accounts: string; cards: string; follows: (name: string) => string; empty: string; some: (n: number) => string }
  menu: { helpFeedback: string; openSettings: string; signIn: string; closeMenu: string; adminPortal: string; admin: string }
  currency: {
    pickTitle: string
    sheetTitle: (next: string) => string
    body: (next: string) => string
    sample: (amount: string) => string
    note: (old: string) => string
    confirm: (next: string) => string
    keep: (old: string) => string
    noRate: string
    toast: (next: string) => string
    undo: string
  }
}

const en: SettingsHubCopy = {
  title: 'Settings',
  searchLabel: 'Search settings',
  searchPlaceholder: 'Search settings',
  clearSearch: 'Clear',
  close: 'Close',
  back: 'Back',
  footer: 'Exchange rates by exchangerate-api.com',
  recent: 'Recent',
  suggestions: 'Try asking for',
  suggestionList: ['Dark mode', 'Delete account', 'Notifications', 'Currency', 'Export data'],
  groupName: {
    profile: 'Profile',
    security: 'Account',
    quick: 'Quick actions',
    autoTrack: 'Auto-track',
    ai: 'Buddgy & AI',
    memory: 'Memory',
    notifications: 'Notifications',
    data: 'Data',
    help: 'Help & about',
  },
  search: {
    noResults: (q) => `Nothing called “${q}”`,
    noResultsHint: 'Try a shorter word, like “dark” or “alerts”.',
    reportMissing: 'Tell us what’s missing',
    open: 'Open',
    hint: 'Jump to any setting. Switches work right here.',
  },
  profileHint: 'View and edit your profile',
  quickTitle: 'Quick actions',
  language: 'Language',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  currencyTile: 'Currency',
  convertTile: 'Convert',
  convertHint: 'Rates',
  convertTitle: 'Currency converter',
  showCents: 'Show cents',
  security: { title: 'Sign-in & security', subtitle: 'Password, two-step, biometrics, app lock', signIn: 'Sign in to manage your account and security.', account: 'Account', memberSince: 'Member since' },
  devices: {
    title: 'Your devices',
    hint: 'Phones signed in to your account',
    thisDevice: 'This device',
    collecting: 'Collecting bank texts',
    lastText: (when) => `Last text ${when}`,
    noTextYet: 'No text received yet',
    activeAgo: (when) => `Active ${when}`,
    notifyHere: 'Notify me on this phone',
    notifyHint: 'Only your main phone is told by default',
    mainBadge: 'Main phone',
    makeMain: 'Make main',
    mainNote: 'Gets your notifications unless you choose otherwise',
    blockedHere: 'Notifications are blocked in this phone’s settings',
    pending: 'Saving…',
    loadFailed: 'Could not load your devices. Check your connection and try again.',
    retry: 'Try again',
    stale: (when) => `Not seen for ${when}`,
    removeTitle: (name) => `Remove ${name}?`,
    removeBody: 'It stops collecting bank texts and notifications now, and signs out the next time it opens.',
    remove: 'Remove',
    removeFailed: 'Could not remove that phone. Try again.',
    saveFailed: 'Could not save that change. Try again.',
    empty: 'Open Buddget on your other phones to see them here.',
    alsoNotifyTitle: 'Notify on this phone too?',
    alsoNotifyBody: (names) => `${names} already gets your notifications. Turn them on here as well and you will be told on both.`,
    alsoNotifyYes: 'Yes, notify here too',
    alsoNotifyNo: 'No, keep this one quiet',
    keptQuiet: 'This phone stays quiet. You can change it in Settings, Your devices.',
  },
  notCounted: {
    subtitle: 'For a card or account someone else uses',
    intro: 'Turn on anything that is not really yours. Its spending, balance and debt stay out of your budget, reports and net worth. Its transactions are still logged.',
    accounts: 'Accounts',
    cards: 'Cards',
    follows: (name) => `Follows ${name}`,
    empty: 'Add an account or card first.',
    some: (n) => `${n} not counted`,
  },
  sms: { title: 'SMS tracking', hint: 'Log bank texts as expenses automatically', iosHint: 'Set up with a Shortcut', on: 'Tracking bank texts', off: 'Off', guide: 'Set up' },
  ai: { title: 'Buddgy & AI', tipsHint: 'Speaks up with timely tips', learningHint: 'Remembers useful facts from chats', memoryHint: 'Household, budget answers and what Buddgy learned', voiceHint: 'Speak answers in voice chats', deviceOnly: 'This device only' },
  notif: {
    title: 'Notifications',
    master: 'Notifications',
    on: 'On for this device',
    off: 'Off',
    blocked: 'Blocked in your device settings',
    unsupported: 'Not available on this browser',
    pushHint: 'Allow notifications in your device settings to switch this on.',
    subs: 'Subscriptions',
    goals: 'Goals',
    dueHint: 'The day before a renewal',
    priceHint: 'When a price changes or a trial ends',
    progressHint: 'At 25, 50, 75 and 100%',
    behindHint: 'Only when you slip, never nagging',
  },
  data: {
    title: 'Your data',
    export: 'Export',
    exportHint: 'Download your data',
    csv: 'Expenses (CSV)',
    csvHint: 'Opens in Excel or Sheets',
    backup: 'Backup file',
    backupHint: 'Move this device’s data to another device',
    import: 'Import a backup',
    importHint: 'Restore from a backup file',
    syncedNote: 'Your data is saved to your account, so there is nothing to back up.',
    deleteCta: 'Delete my account',
    deleteHint: 'Permanently removes your account and all its data.',
  },
  help: {
    title: 'Help & about',
    feedback: 'Send feedback',
    feedbackHint: 'Report a bug, share an idea or ask a question',
    bug: 'Bug',
    idea: 'Idea',
    question: 'Question',
    inbox: 'My requests',
    board: 'Ideas board',
    boardHint: 'Vote on what we build next',
    boardEmpty: 'No ideas are up for a vote yet. Share one with Send feedback.',
    boardState: { published: 'Open for votes', planned: 'Planned', shipped: 'Shipped' },
    upvote: 'Vote up',
    downvote: 'Vote down',
    inboxHint: 'Replies from the Buddget team',
    inboxEmpty: 'You have not sent anything yet.',
    reply: 'Send',
    replyHint: 'Write a reply',
    youLabel: 'You',
    status: { open: 'Open', pending: 'We replied', resolved: 'Resolved', closed: 'Closed' },
    terms: 'Terms of use',
    privacy: 'Privacy policy',
    about: 'About Buddget',
    aboutHint: 'Version, story and contact',
    version: 'Version',
    story: [
      'Buddget started with a simple annoyance: money apps that make you type every coffee and think in one currency.',
      'So it reads your bank texts, understands more than one currency, and keeps your month honest without a spreadsheet.',
      'Your data stays yours. We build it in the open with the people who use it, so tell us what to fix next.',
    ],
    web: 'buddget.app',
    contact: 'support@buddget.app',
    madeWith: 'Made with care for people who count in more than one currency.',
  },
  memory: {
    title: 'Memory',
    intro: 'What Buddgy knows about your money. It uses this to size budgets and answer you, and it updates as you chat.',
    household: 'Household & rent',
    householdEmpty: 'Not set yet',
    rent: 'Monthly rent',
    lifestyle: 'Lifestyle',
    budget: 'Budget answers',
    entry: 'Budget entry',
    entryAmount: 'Amount',
    entryPercent: '% of income',
    weekStart: 'First day of week',
    weekSat: 'Sat',
    weekSun: 'Sun',
    weekMon: 'Mon',
    gold: 'Gold price strip',
    goldHint: 'Live gold price on Wealth',
    learned: 'Learned from chats',
    learnedEmpty: 'Nothing yet. Tell Buddgy things like “I share rent with a roommate” and it will remember.',
    forget: 'Forget',
    onboarding: 'Getting to know you',
    onboardingEmpty: 'Questions Buddgy asks as you use the app will show up here.',
    edit: 'Edit',
    source: { chat: 'From a chat', manual: 'You added', budget: 'From your budget', onboarding: 'From setup' },
  },
  items: {
    profile: { label: 'Profile', keywords: 'name avatar photo picture phone country city اسم صورة', exact: ['profile', 'name', 'avatar', 'الملف الشخصي'] },
    password: { label: 'Change password', keywords: 'security login كلمة السر كلمة المرور', exact: ['password'] },
    twoFactor: { label: 'Two-step sign-in', keywords: '2fa otp email code security التحقق بخطوتين' },
    biometric: { label: 'Face ID & fingerprint', keywords: 'biometric touch unlock بصمة وجه' },
    appLock: { label: 'App lock', keywords: 'pin passcode lock قفل التطبيق' },
    deleteAccount: { label: 'Delete account', keywords: 'remove erase close account حذف الحساب', exact: ['delete account', 'delete', 'حذف الحساب'] },
    baseCurrency: { label: 'Main currency', keywords: 'currency egp usd dollar pound euro عملة جنيه دولار', exact: ['currency', 'عملة'] },
    secondaryCurrency: { label: 'Second currency', keywords: 'secondary also exchange عملة ثانية' },
    converter: { label: 'Currency converter', keywords: 'rate exchange calculate convert تحويل العملات' },
    theme: { label: 'Theme', keywords: 'dark mode light night appearance مظهر داكن فاتح وضع الوضع الداكن ليلي', exact: ['dark mode', 'theme', 'dark', 'الوضع الداكن', 'داكن'] },
    language: { label: 'Language', keywords: 'arabic english عربي انجليزي لغة', exact: ['language', 'لغة'] },
    showCents: { label: 'Show cents', keywords: 'decimals pennies قروش هللة' },
    sms: { label: 'SMS tracking', keywords: 'bank auto track messages رسائل بنك', exact: ['sms', 'رسائل'] },
    tips: { label: 'Buddgy tips', keywords: 'nudge suggestion assistant ai نصائح', exact: ['tips', 'نصائح'] },
    learning: { label: 'Learn from chats', keywords: 'memory assistant ai تعلم' },
    memories: { label: 'Memory', keywords: 'memories forget household rent budget answers ذاكرة', exact: ['memory', 'ذاكرة'] },
    voiceReadAloud: { label: 'Read answers aloud', keywords: 'voice speak tts mute صوت' },
    household: { label: 'Household & rent', keywords: 'family rent home people ايجار اسرة' },
    lifestyle: { label: 'Lifestyle', keywords: 'food transport habits نمط الحياة' },
    budgetEntryMode: { label: 'Budget entry', keywords: 'percent income amount budget ميزانية نسبة' },
    weekStart: { label: 'First day of week', keywords: 'week start saturday sunday monday calendar أسبوع سبت أحد اثنين' },
    goldStrip: { label: 'Gold price strip', keywords: 'xau wealth ذهب' },
    pushStatus: { label: 'Notifications', keywords: 'push permission allow alerts إشعارات تنبيهات', exact: ['notifications', 'alerts', 'إشعارات'] },
    subDueReminders: { label: 'Subscription reminders', keywords: 'due renew bill notification اشتراك تذكير' },
    subPriceAlerts: { label: 'Price-rise alerts', keywords: 'trial price increase notification سعر' },
    goalProgressAlerts: { label: 'Goal milestones', keywords: 'progress achievement notification هدف' },
    goalAlerts: { label: 'Behind-plan alerts', keywords: 'late goal notification متأخر' },
    notCounted: { label: 'Accounts not counted', keywords: 'exclude hide ignore card someone else not mine spending balance net worth استبعاد حساب بطاقة مش بتاعتي' },
    exportData: { label: 'Export data', keywords: 'backup download csv json نسخة احتياطية تصدير', exact: ['export', 'backup', 'تصدير'] },
    restoreBackup: { label: 'Import a backup', keywords: 'restore upload json استعادة استيراد' },
    feedback: { label: 'Send feedback', keywords: 'bug idea feature support report ملاحظات مشكلة', exact: ['feedback', 'bug', 'support'] },
    terms: { label: 'Terms of use', keywords: 'legal شروط' },
    privacy: { label: 'Privacy policy', keywords: 'legal data خصوصية' },
    about: { label: 'About Buddget', keywords: 'version story contact social حول الإصدار' },
  },
  menu: { helpFeedback: 'Help & feedback', openSettings: 'Settings', signIn: 'Sign in', closeMenu: 'Close menu', adminPortal: 'Admin portal', admin: 'Admin' },
  currency: {
    pickTitle: 'Main currency',
    sheetTitle: (next) => `Switch main currency to ${next}?`,
    body: (next) => `Totals and charts will show in ${next}. Everything you’ve logged keeps its own currency and converts at today’s rate.`,
    sample: (amount) => `Example: ${amount}`,
    note: (old) => `We also convert your saved monthly rent, and older budget lines get tagged ${old} so their meaning doesn’t change.`,
    confirm: (next) => `Switch to ${next}`,
    keep: (old) => `Keep ${old}`,
    noRate: 'No exchange rate is available for that currency yet. Try again once rates have loaded.',
    toast: (next) => `Main currency is now ${next}`,
    undo: 'Undo',
  },
}

const ar: SettingsHubCopy = {
  title: 'الإعدادات',
  searchLabel: 'دوّر في الإعدادات',
  searchPlaceholder: 'دوّر في الإعدادات',
  clearSearch: 'مسح',
  close: 'إغلاق',
  back: 'رجوع',
  footer: 'أسعار الصرف من exchangerate-api.com',
  recent: 'الأخيرة',
  suggestions: 'جرّب تدوّر على',
  suggestionList: ['الوضع الداكن', 'حذف الحساب', 'الإشعارات', 'العملة', 'تصدير البيانات'],
  groupName: {
    profile: 'الملف الشخصي',
    security: 'الحساب',
    quick: 'إجراءات سريعة',
    autoTrack: 'التتبع التلقائي',
    ai: 'بادجي والذكاء الاصطناعي',
    memory: 'الذاكرة',
    notifications: 'الإشعارات',
    data: 'البيانات',
    help: 'المساعدة وحول',
  },
  search: {
    noResults: (q) => `مفيش حاجة اسمها “${q}”`,
    noResultsHint: 'جرّب كلمة أقصر زي “داكن” أو “تنبيهات”.',
    reportMissing: 'قولّنا إيه الناقص',
    open: 'فتح',
    hint: 'روح لأي إعداد. المفاتيح بتشتغل هنا مباشرة.',
  },
  profileHint: 'شوف ملفك وعدّله',
  quickTitle: 'إجراءات سريعة',
  language: 'اللغة',
  theme: 'المظهر',
  themeLight: 'فاتح',
  themeDark: 'داكن',
  currencyTile: 'العملة',
  convertTile: 'تحويل',
  convertHint: 'الأسعار',
  convertTitle: 'محوّل العملات',
  showCents: 'إظهار القروش',
  security: { title: 'الدخول والأمان', subtitle: 'كلمة المرور والتحقق بخطوتين والبصمة وقفل التطبيق', signIn: 'سجّل دخولك عشان تدير حسابك وأمانه.', account: 'الحساب', memberSince: 'عضو منذ' },
  devices: {
    title: 'أجهزتك',
    hint: 'الموبايلات المسجّل دخولها لحسابك',
    thisDevice: 'الجهاز ده',
    collecting: 'بيجمع رسائل البنك',
    lastText: (when) => `آخر رسالة ${when}`,
    noTextYet: 'لسه ما وصلتش رسالة',
    activeAgo: (when) => `نشط ${when}`,
    notifyHere: 'نبّهني على الموبايل ده',
    notifyHint: 'الموبايل الأساسي بس هو اللي بيتنبّه افتراضي',
    mainBadge: 'الموبايل الأساسي',
    makeMain: 'خليه الأساسي',
    mainNote: 'بيجيله إشعاراتك إلا لو اخترت غير كده',
    blockedHere: 'الإشعارات محظورة من إعدادات الموبايل ده',
    pending: 'بنحفظ…',
    loadFailed: 'مقدرناش نحمّل أجهزتك. اتأكد من النت وجرّب تاني.',
    retry: 'جرّب تاني',
    stale: (when) => `ما اتشافش من ${when}`,
    removeTitle: (name) => `تشيل ${name}؟`,
    removeBody: 'هيبطّل يجمع رسائل البنك والإشعارات دلوقتي، وهيسجّل خروج أول ما يتفتح.',
    remove: 'إزالة',
    removeFailed: 'مقدرناش نشيل الموبايل ده. جرّب تاني.',
    saveFailed: 'مقدرناش نحفظ التغيير ده. جرّب تاني.',
    empty: 'افتح بادجت على موبايلاتك التانية عشان تظهر هنا.',
    alsoNotifyTitle: 'تتنبّه على الموبايل ده كمان؟',
    alsoNotifyBody: (names) => `${names} بيجيله إشعاراتك فعلاً. لو فعّلتها هنا كمان هتتنبّه على الاتنين.`,
    alsoNotifyYes: 'أيوه، نبّهني هنا كمان',
    alsoNotifyNo: 'لأ، سيب ده ساكت',
    keptQuiet: 'الموبايل ده هيفضل ساكت. تقدر تغيّر ده من الإعدادات، أجهزتك.',
  },
  notCounted: {
    subtitle: 'لبطاقة أو حساب يستخدمه شخص تاني',
    intro: 'فعّل أي حاجة مش بتاعتك فعلاً. مصروفاتها ورصيدها ودينها بيفضلوا بره ميزانيتك وتقاريرك وصافي ثروتك. معاملاتها بتفضل مسجّلة.',
    accounts: 'الحسابات',
    cards: 'البطاقات',
    follows: (name) => `تابعة لـ ${name}`,
    empty: 'ضيف حساب أو بطاقة الأول.',
    some: (n) => `${n} غير محسوب`,
  },
  sms: { title: 'تتبع الرسائل', hint: 'سجّل رسائل البنك كمصروفات تلقائي', iosHint: 'بيتظبط بـ Shortcut', on: 'بيتابع رسائل البنك', off: 'مقفول', guide: 'إعداد' },
  ai: { title: 'بادجي والذكاء الاصطناعي', tipsHint: 'بيقترح نصايح في وقتها', learningHint: 'بيفتكر معلومات مفيدة من كلامك معاه', memoryHint: 'الأسرة وإجابات الميزانية واللي اتعلّمه بادجي', voiceHint: 'بينطق الإجابات في المحادثات الصوتية', deviceOnly: 'على الجهاز ده بس' },
  notif: {
    title: 'الإشعارات',
    master: 'الإشعارات',
    on: 'مفعّلة على الجهاز ده',
    off: 'مقفولة',
    blocked: 'محظورة من إعدادات الجهاز',
    unsupported: 'مش متاحة في المتصفح ده',
    pushHint: 'اسمح بالإشعارات من إعدادات جهازك عشان تفعّلها.',
    subs: 'الاشتراكات',
    goals: 'الأهداف',
    dueHint: 'قبل التجديد بيوم',
    priceHint: 'لما السعر يتغير أو التجربة تخلص',
    progressHint: 'عند ٢٥ و٥٠ و٧٥ و١٠٠٪',
    behindHint: 'بس لما تتأخر، من غير إزعاج',
  },
  data: {
    title: 'بياناتك',
    export: 'تصدير',
    exportHint: 'نزّل بياناتك',
    csv: 'المصروفات (CSV)',
    csvHint: 'بيفتح في إكسل أو جوجل شيت',
    backup: 'ملف نسخة احتياطية',
    backupHint: 'انقل بيانات الجهاز ده لجهاز تاني',
    import: 'استيراد نسخة احتياطية',
    importHint: 'استرجع من ملف نسخة احتياطية',
    syncedNote: 'بياناتك محفوظة في حسابك، مفيش داعي لنسخة احتياطية.',
    deleteCta: 'احذف حسابي',
    deleteHint: 'بيمسح حسابك وكل بياناته نهائي.',
  },
  help: {
    title: 'المساعدة وحول',
    feedback: 'أرسل ملاحظاتك',
    feedbackHint: 'بلّغ عن مشكلة أو اقترح فكرة',
    bug: 'خطأ',
    idea: 'ميزة',
    question: 'سؤال',
    inbox: 'طلباتي',
    board: 'لوحة الأفكار',
    boardHint: 'صوّت على اللي هنبنيه بعد كده',
    boardEmpty: 'مفيش أفكار للتصويت لسه. ابعت فكرتك من «أرسل ملاحظاتك».',
    boardState: { published: 'مفتوح للتصويت', planned: 'مخطط له', shipped: 'اتنفّذ' },
    upvote: 'صوّت لفوق',
    downvote: 'صوّت لتحت',
    inboxHint: 'ردود فريق Buddget',
    inboxEmpty: 'لسه ما بعتّش حاجة.',
    reply: 'إرسال',
    replyHint: 'اكتب ردك',
    youLabel: 'إنت',
    status: { open: 'مفتوح', pending: 'رددنا عليك', resolved: 'اتحل', closed: 'مقفول' },
    terms: 'شروط الاستخدام',
    privacy: 'سياسة الخصوصية',
    about: 'حول بادجت',
    aboutHint: 'الإصدار والقصة والتواصل',
    version: 'الإصدار',
    story: [
      'بادجت بدأ من حاجة بسيطة بتضايق: تطبيقات فلوس بتخليك تكتب كل قهوة وتفكر بعملة واحدة.',
      'عشان كده بيقرأ رسائل البنك وبيفهم أكتر من عملة وبيخلي شهرك مظبوط من غير جدول بيانات.',
      'بياناتك فضلة بتاعتك. بنبنيه مع اللي بيستخدموه، فقولّنا نصلح إيه بعد كده.',
    ],
    web: 'buddget.app',
    contact: 'support@buddget.app',
    madeWith: 'اتعمل بحب لكل اللي بيحسبوا بأكتر من عملة.',
  },
  memory: {
    title: 'الذاكرة',
    intro: 'اللي بادجي عارفه عن فلوسك. بيستخدمه يقدّر الميزانيات ويرد عليك، وبيتحدّث وانت بتكلمه.',
    household: 'الأسرة والإيجار',
    householdEmpty: 'لم يُحدَّد بعد',
    rent: 'الإيجار الشهري',
    lifestyle: 'نمط الحياة',
    budget: 'إجابات الميزانية',
    entry: 'إدخال الميزانية',
    entryAmount: 'مبلغ',
    entryPercent: '٪ من الدخل',
    weekStart: 'أول يوم في الأسبوع',
    weekSat: 'السبت',
    weekSun: 'الأحد',
    weekMon: 'الإثنين',
    gold: 'شريط سعر الذهب',
    goldHint: 'سعر الذهب المباشر في الثروة',
    learned: 'ما تعلّمه من المحادثات',
    learnedEmpty: 'لسه مفيش حاجة. قول لبادجي حاجة زي “باتشارك الإيجار مع زميل” وهيفتكر.',
    forget: 'نسيان',
    onboarding: 'التعرّف عليك',
    onboardingEmpty: 'الأسئلة اللي بادجي بيسألها وانت بتستخدم التطبيق هتظهر هنا.',
    edit: 'تعديل',
    source: { chat: 'من محادثة', manual: 'أضفته أنت', budget: 'من ميزانيتك', onboarding: 'من الإعداد' },
  },
  items: {
    profile: { label: 'الملف الشخصي', keywords: 'name avatar photo picture phone country city اسم صورة', exact: ['profile', 'name', 'avatar', 'الملف الشخصي'] },
    password: { label: 'تغيير كلمة المرور', keywords: 'security login كلمة السر كلمة المرور password', exact: ['password'] },
    twoFactor: { label: 'التحقق بخطوتين', keywords: '2fa otp email code security التحقق بخطوتين' },
    biometric: { label: 'بصمة الوجه والإصبع', keywords: 'biometric touch unlock بصمة وجه' },
    appLock: { label: 'قفل التطبيق', keywords: 'pin passcode lock قفل التطبيق' },
    deleteAccount: { label: 'حذف الحساب', keywords: 'remove erase close account delete حذف الحساب', exact: ['delete account', 'delete', 'حذف الحساب'] },
    baseCurrency: { label: 'العملة الأساسية', keywords: 'currency egp usd dollar pound euro عملة جنيه دولار', exact: ['currency', 'عملة'] },
    secondaryCurrency: { label: 'العملة الثانية', keywords: 'secondary also exchange عملة ثانية' },
    converter: { label: 'محوّل العملات', keywords: 'rate exchange calculate convert تحويل العملات' },
    theme: { label: 'المظهر', keywords: 'dark mode light night appearance theme مظهر داكن فاتح وضع الوضع الداكن ليلي', exact: ['dark mode', 'theme', 'dark', 'الوضع الداكن', 'داكن'] },
    language: { label: 'اللغة', keywords: 'arabic english language عربي انجليزي لغة', exact: ['language', 'لغة'] },
    showCents: { label: 'إظهار القروش', keywords: 'decimals pennies cents قروش هللة' },
    sms: { label: 'تتبع الرسائل', keywords: 'bank auto track messages sms رسائل بنك', exact: ['sms', 'رسائل'] },
    tips: { label: 'نصائح بادجي', keywords: 'nudge suggestion assistant ai tips نصائح', exact: ['tips', 'نصائح'] },
    learning: { label: 'التعلّم من المحادثات', keywords: 'memory assistant ai learn تعلم' },
    memories: { label: 'الذاكرة', keywords: 'memories forget household rent budget answers memory ذاكرة', exact: ['memory', 'ذاكرة'] },
    voiceReadAloud: { label: 'قراءة الإجابات بصوت عال', keywords: 'voice speak tts mute صوت' },
    household: { label: 'الأسرة والإيجار', keywords: 'family rent home people household ايجار اسرة' },
    lifestyle: { label: 'نمط الحياة', keywords: 'food transport habits lifestyle نمط الحياة' },
    budgetEntryMode: { label: 'إدخال الميزانية', keywords: 'percent income amount budget ميزانية نسبة' },
    weekStart: { label: 'أول يوم في الأسبوع', keywords: 'week start saturday sunday monday calendar أسبوع سبت أحد اثنين' },
    goldStrip: { label: 'شريط سعر الذهب', keywords: 'xau wealth gold ذهب' },
    pushStatus: { label: 'الإشعارات', keywords: 'push permission allow alerts notifications إشعارات تنبيهات', exact: ['notifications', 'alerts', 'إشعارات'] },
    subDueReminders: { label: 'تذكير الاشتراكات', keywords: 'due renew bill notification اشتراك تذكير' },
    subPriceAlerts: { label: 'تنبيهات ارتفاع السعر', keywords: 'trial price increase notification سعر' },
    goalProgressAlerts: { label: 'محطات الأهداف', keywords: 'progress achievement notification هدف' },
    goalAlerts: { label: 'تنبيهات التأخر عن الخطة', keywords: 'late goal notification متأخر' },
    notCounted: { label: 'حسابات غير محسوبة', keywords: 'exclude hide ignore card استبعاد تجاهل حساب بطاقة مش بتاعتي مصروفات رصيد' },
    exportData: { label: 'تصدير البيانات', keywords: 'backup download csv json export نسخة احتياطية تصدير', exact: ['export', 'backup', 'تصدير'] },
    restoreBackup: { label: 'استيراد نسخة احتياطية', keywords: 'restore upload json import استعادة استيراد' },
    feedback: { label: 'أرسل ملاحظاتك', keywords: 'bug idea feature support report feedback ملاحظات مشكلة', exact: ['feedback', 'bug', 'support'] },
    terms: { label: 'شروط الاستخدام', keywords: 'legal terms شروط' },
    privacy: { label: 'سياسة الخصوصية', keywords: 'legal data privacy خصوصية' },
    about: { label: 'حول بادجت', keywords: 'version story contact social about حول الإصدار' },
  },
  menu: { helpFeedback: 'المساعدة والملاحظات', openSettings: 'الإعدادات', signIn: 'تسجيل الدخول', closeMenu: 'إغلاق القائمة', adminPortal: 'لوحة الإدارة', admin: 'مسؤول' },
  currency: {
    pickTitle: 'العملة الأساسية',
    sheetTitle: (next) => `نبدّل العملة الأساسية إلى ${next}؟`,
    body: (next) => `الإجماليات والرسوم هتظهر بـ ${next}. كل حاجة سجّلتها بتفضل بعملتها الأصلية وبتتحوّل بسعر اليوم.`,
    sample: (amount) => `مثال: ${amount}`,
    note: (old) => `بنحوّل إيجارك الشهري المحفوظ، وخطوط الميزانية القديمة بتتحدد بـ ${old} عشان معناها ما يتغيرش.`,
    confirm: (next) => `بدّل إلى ${next}`,
    keep: (old) => `خليها ${old}`,
    noRate: 'مفيش سعر صرف متاح للعملة دي لسه. جرّب تاني بعد تحميل الأسعار.',
    toast: (next) => `العملة الأساسية الآن ${next}`,
    undo: 'تراجع',
  },

}

export const settingsHubCopy: Record<Locale, SettingsHubCopy> = { en, ar }

export function useSettingsHubCopy(): SettingsHubCopy {
  const { locale } = useLocale()
  return settingsHubCopy[locale]
}
