import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { RoomId, SettingId } from '@/lib/settings/registry'

export interface SettingItemCopy {
  label: string
  /** Extra search words in both languages; the label is always searched too. */
  keywords: string
  /** Phrases that should put this setting first (“currency” → main currency, not the converter). */
  exact?: string[]
}

export interface SettingsHubCopy {
  title: string
  searchPlaceholder: string
  searchLabel: string
  clearSearch: string
  hostLine: string
  setupRing: (left: number) => string
  quickTitle: string
  mainCurrency: string
  mainShort: string
  alsoShow: string
  secondShort: string
  secondCurrency: string
  addSecond: string
  noSecond: string
  swap: string
  language: string
  theme: string
  themeLight: string
  themeAuto: string
  themeDark: string
  roomsCap: string
  footer: string
  back: string
  rooms: Record<RoomId, { title: string; remark: string }>
  status: {
    you: string
    money: (base: string, second: string | null, day: number) => string
    alerts: (on: number, total: number) => string
    buddgy: (tips: boolean, sms: boolean) => string
    look: (theme: string, language: string) => string
    data: string
    help: string
  }
  items: Record<SettingId, SettingItemCopy>
  search: {
    noResults: (q: string) => string
    noResultsHint: string
    reportMissing: string
    inRoom: (room: string) => string
  }
  menu: { helpFeedback: string; openSettings: string; signIn: string; closeMenu: string; adminPortal: string }
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
  payCycle: {
    title: string
    question: string
    hint: string
    decrease: string
    increase: string
    today: string
    current: string
    note: string
    paydays: string
    paydaysHint: string
    range: (from: string, to: string) => string
  }
  you: { account: string; security: string; money: string; signedOutHint: string }
  moneyPage: {
    currency: string
    cycle: string
    wallets: string
    rules: string
    entryTitle: string
    entryAmount: string
    entryPercent: string
    goldHint: string
    onlyMineHint: string
    secondHint: (name: string) => string
    paymentMethodsHint: (n: number) => string
    householdHint: string
    lifestyleHint: string
    converterHint: string
  }
  alertsPage: {
    master: string
    subscriptions: string
    goals: string
    allowed: string
    blocked: string
    notAsked: string
    unsupported: string
    pushHint: string
    dueHint: string
    priceHint: string
    progressHint: string
    behindHint: string
  }
  buddgyPage: { assistant: string; assistantHint: (tips: boolean, learning: boolean) => string; voice: string; voiceHint: string; deviceOnly: string; tracking: string; trackingHint: string }
  lookPage: { appearance: string; text: string; centsHint: string; languageHint: string }
  dataPage: { tools: string; resetTips: string; resetTipsHint: string; resetTipsDone: string }
  helpPage: { support: string; legal: string; about: string; version: string; feedbackHint: string }
}

const en: SettingsHubCopy = {
  title: 'Settings',
  searchPlaceholder: 'Try “salary day” or “dark mode”',
  searchLabel: 'Search settings',
  clearSearch: 'Clear search',
  hostLine: 'Pick a room. I’ll keep the switches warm.',
  setupRing: (n) => (n === 1 ? '1 thing left' : `${n} things left`),
  quickTitle: 'Quick changes',
  mainCurrency: 'Main currency',
  mainShort: 'Main',
  alsoShow: 'Also show',
  secondShort: 'Second',
  secondCurrency: 'Second currency',
  addSecond: 'Add',
  noSecond: 'No second currency',
  swap: 'Swap main and second currency',
  language: 'Language',
  theme: 'Theme',
  themeLight: 'Light',
  themeAuto: 'Auto',
  themeDark: 'Dark',
  roomsCap: 'Rooms',
  footer: 'Exchange rates by exchangerate-api.com',
  back: 'Back',
  rooms: {
    you: { title: 'You', remark: 'Lock the door behind you.' },
    money: { title: 'Money', remark: 'Tell me when your month really starts.' },
    alerts: { title: 'Alerts', remark: 'I only ping when it matters.' },
    buddgy: { title: 'Buddgy & auto-track', remark: 'I learn, you stay in charge.' },
    look: { title: 'Look & language', remark: 'Dress the app your way.' },
    data: { title: 'Data & privacy', remark: 'Your numbers, your call.' },
    help: { title: 'Help & about', remark: 'Stuck? I’ve got you.' },
  },
  status: {
    you: 'Profile, sign-in, security',
    money: (base, second, day) => `${base}${second ? ` + ${second}` : ''} · month starts day ${day}`,
    alerts: (on, total) => `${on} of ${total} on`,
    buddgy: (tips, sms) => `Tips ${tips ? 'on' : 'off'} · SMS ${sms ? 'on' : 'off'}`,
    look: (theme, language) => `${theme} · ${language}`,
    data: 'Export, restore, reset',
    help: 'Feedback, legal, version',
  },
  items: {
    profile: { label: 'Profile', keywords: 'name avatar photo picture phone country city اسم صورة', exact: ['profile', 'name', 'avatar', 'الملف الشخصي'] },
    account: { label: 'Account & security', keywords: 'email member sign out login حساب' },
    password: { label: 'Change password', keywords: 'security login كلمة السر كلمة المرور' },
    twoFactor: { label: 'Two-step sign-in', keywords: '2fa otp email code security التحقق بخطوتين' },
    biometric: { label: 'Face ID & app lock', keywords: 'fingerprint biometric lock touch pin بصمة قفل' },
    deleteAccount: { label: 'Delete account', keywords: 'remove erase close account حذف الحساب' },
    paymentMethods: { label: 'Payment methods', keywords: 'card bank visa wallet account بطاقة بنك وسائل الدفع', exact: ['cards', 'card', 'payment', 'بطاقات', 'بطاقة'] },
    baseCurrency: { label: 'Main currency', keywords: 'currency egp usd dollar pound euro عملة جنيه دولار', exact: ['currency', 'عملة'] },
    secondaryCurrency: { label: 'Show a second currency', keywords: 'secondary also exchange عملة ثانية' },
    onlyMyCurrencies: { label: 'Only my currencies in forms', keywords: 'hide currencies picker العملات' },
    converter: { label: 'Currency converter', keywords: 'rate exchange calculate تحويل العملات' },
    payCycle: { label: 'Month starts on', keywords: 'pay cycle salary day payday month start budget راتب يوم الراتب بداية الشهر', exact: ['salary day', 'pay cycle', 'payday', 'يوم الراتب'] },
    household: { label: 'Household & rent', keywords: 'family rent home people ايجار اسرة' },
    lifestyle: { label: 'Lifestyle', keywords: 'food transport habits نمط الحياة' },
    budgetEntryMode: { label: 'Budget entry', keywords: 'percent income amount budget ميزانية نسبة' },
    goldStrip: { label: 'Gold price strip', keywords: 'xau wealth ذهب' },
    subDueReminders: { label: 'Subscription reminders', keywords: 'due renew bill notification اشتراك تذكير' },
    subPriceAlerts: { label: 'Price-rise alerts', keywords: 'trial price increase notification سعر' },
    goalProgressAlerts: { label: 'Goal milestones', keywords: 'progress achievement notification هدف' },
    goalAlerts: { label: 'Behind-plan alerts', keywords: 'late goal notification متأخر' },
    pushStatus: { label: 'Push notifications', keywords: 'permission allow notification إشعارات' },
    tips: { label: 'Buddgy tips', keywords: 'nudge suggestion assistant ai نصائح', exact: ['tips', 'نصائح'] },
    learning: { label: 'Learn from chats', keywords: 'memory assistant ai تعلم' },
    memories: { label: 'What Buddgy remembers', keywords: 'memories forget ذاكرة' },
    voiceReadAloud: { label: 'Read answers aloud', keywords: 'voice speak tts mute صوت' },
    sms: { label: 'SMS tracking', keywords: 'bank auto track messages رسائل بنك', exact: ['sms', 'رسائل'] },
    theme: { label: 'Theme', keywords: 'dark mode light night appearance مظهر داكن فاتح وضع الوضع الداكن ليلي', exact: ['dark mode', 'theme', 'dark', 'الوضع الداكن', 'داكن'] },
    language: { label: 'Language', keywords: 'arabic english عربي انجليزي لغة', exact: ['language', 'لغة'] },
    showCents: { label: 'Show cents', keywords: 'decimals pennies قروش هللة' },
    exportData: { label: 'Export data', keywords: 'backup download csv json نسخة احتياطية تصدير', exact: ['export', 'backup', 'تصدير'] },
    restoreBackup: { label: 'Restore a backup', keywords: 'import upload json استعادة' },
    resetTips: { label: 'Reset tips & prompts', keywords: 'dismissed banners hints إعادة ضبط' },
    startFresh: { label: 'Start fresh', keywords: 'delete erase wipe reset data ابدأ من جديد مسح', exact: ['reset', 'delete data', 'مسح'] },
    feedback: { label: 'Report an issue', keywords: 'bug idea feedback support ملاحظات مشكلة', exact: ['feedback', 'bug', 'support'] },
    terms: { label: 'Terms of use', keywords: 'legal شروط' },
    privacy: { label: 'Privacy policy', keywords: 'legal data خصوصية' },
  },
  search: {
    noResults: (q) => `Nothing called “${q}”`,
    noResultsHint: 'Try “salary”, “dark” or “cards”.',
    reportMissing: 'Tell us what’s missing',
    inRoom: (room) => room,
  },
  menu: { helpFeedback: 'Help & feedback', openSettings: 'Settings', signIn: 'Sign in', closeMenu: 'Close menu', adminPortal: 'Admin portal' },
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
  payCycle: {
    title: 'Pay cycle',
    question: 'My month starts on day',
    hint: 'Usually the day your salary lands.',
    decrease: 'Earlier day',
    increase: 'Later day',
    today: 'today',
    current: 'Your current cycle',
    note: 'Past entries keep their dates; your months are cut differently from now on.',
    paydays: 'Paydays',
    paydaysHint: 'Salary, rent and other regular income',
    range: (from, to) => `${from} → ${to}`,
  },
  you: { account: 'Account', security: 'Sign-in & security', money: 'Money', signedOutHint: 'Sign in to manage your account and security.' },
  moneyPage: {
    currency: 'Currency',
    cycle: 'Pay cycle',
    wallets: 'Cards & accounts',
    rules: 'Money rules',
    entryTitle: 'Budget entry',
    entryAmount: 'Amount',
    entryPercent: '% of income',
    goldHint: 'Live gold price on Wealth',
    onlyMineHint: 'Hides the rest from pickers',
    secondHint: (name) => name,
    paymentMethodsHint: (n) => (n === 1 ? '1 card or account' : `${n} cards & accounts`),
    householdHint: 'Helps Buddgy size your budget',
    lifestyleHint: 'Food and transport habits',
    converterHint: 'Convert any amount',
  },
  alertsPage: {
    master: 'Notifications',
    subscriptions: 'Subscriptions',
    goals: 'Goals',
    allowed: 'Allowed on this device',
    blocked: 'Blocked in phone settings',
    notAsked: 'Not asked yet',
    unsupported: 'Not available here',
    pushHint: 'Allow notifications in your phone settings to get these alerts.',
    dueHint: 'The day before a renewal',
    priceHint: 'When a price changes or a trial ends',
    progressHint: 'At 25, 50, 75 and 100%',
    behindHint: 'Only when you slip, never nagging',
  },
  buddgyPage: {
    assistant: 'Assistant',
    assistantHint: (tips, learning) => `Tips ${tips ? 'on' : 'off'} · learning ${learning ? 'on' : 'off'}`,
    voice: 'Read answers aloud',
    voiceHint: 'Buddgy speaks its answers in voice chats',
    deviceOnly: 'This device only',
    tracking: 'Auto-track',
    trackingHint: 'Log bank texts as expenses',
  },
  lookPage: { appearance: 'Appearance', text: 'Language & numbers', centsHint: 'Show amounts with decimals', languageHint: 'English or Arabic' },
  dataPage: {
    tools: 'Tidy up',
    resetTips: 'Reset tips & prompts',
    resetTipsHint: 'Bring back banners you dismissed',
    resetTipsDone: 'Tips and prompts are back',
  },
  helpPage: { support: 'Support', legal: 'Legal', about: 'About', version: 'Version', feedbackHint: 'Bugs, ideas, anything' },
}

const ar: SettingsHubCopy = {
  title: 'الإعدادات',
  searchPlaceholder: 'جرّب «يوم الراتب» أو «الوضع الداكن»',
  searchLabel: 'ابحث في الإعدادات',
  clearSearch: 'مسح البحث',
  hostLine: 'اختار قسم، وأنا أظبط الباقي.',
  setupRing: (n) => (n === 1 ? 'باقي خطوة واحدة' : `باقي ${n} خطوات`),
  quickTitle: 'تغييرات سريعة',
  mainCurrency: 'العملة الأساسية',
  mainShort: 'الأساسية',
  alsoShow: 'عرض أيضًا',
  secondShort: 'الثانية',
  secondCurrency: 'العملة الثانية',
  addSecond: 'إضافة',
  noSecond: 'بدون عملة ثانية',
  swap: 'تبديل العملة الأساسية والثانية',
  language: 'اللغة',
  theme: 'المظهر',
  themeLight: 'فاتح',
  themeAuto: 'تلقائي',
  themeDark: 'داكن',
  roomsCap: 'الأقسام',
  footer: 'أسعار الصرف من exchangerate-api.com',
  back: 'رجوع',
  rooms: {
    you: { title: 'أنت', remark: 'اقفل الباب وراك.' },
    money: { title: 'المال', remark: 'قولي الشهر بيبدأ إمتى بجد.' },
    alerts: { title: 'التنبيهات', remark: 'مش هنبّهك غير لما يفرق.' },
    buddgy: { title: 'بادجي والتتبع التلقائي', remark: 'أنا بتعلّم وانت اللي بتقرر.' },
    look: { title: 'المظهر واللغة', remark: 'غيّر شكل التطبيق على كيفك.' },
    data: { title: 'البيانات والخصوصية', remark: 'أرقامك، وانت اللي تقرر.' },
    help: { title: 'المساعدة وحول التطبيق', remark: 'محتاج مساعدة؟ أنا معاك.' },
  },
  status: {
    you: 'الملف الشخصي والأمان',
    money: (base, second, day) => `${base}${second ? ` + ${second}` : ''} · الشهر يبدأ يوم ${day}`,
    alerts: (on, total) => `${on} من ${total} مفعّلة`,
    buddgy: (tips, sms) => `النصائح ${tips ? 'تعمل' : 'متوقفة'} · الرسائل ${sms ? 'تعمل' : 'متوقفة'}`,
    look: (theme, language) => `${theme} · ${language}`,
    data: 'تصدير واستعادة وإعادة ضبط',
    help: 'الملاحظات والشروط والإصدار',
  },
  items: {
    profile: { label: 'الملف الشخصي', keywords: 'name avatar photo picture phone country city اسم صورة', exact: ['profile', 'name', 'avatar', 'الملف الشخصي'] },
    account: { label: 'الحساب والأمان', keywords: 'email member sign out login حساب' },
    password: { label: 'تغيير كلمة المرور', keywords: 'security login كلمة السر' },
    twoFactor: { label: 'التحقق بخطوتين', keywords: '2fa otp email code security' },
    biometric: { label: 'بصمة الوجه وقفل التطبيق', keywords: 'fingerprint biometric lock touch pin بصمة قفل' },
    deleteAccount: { label: 'حذف الحساب', keywords: 'remove erase close account' },
    paymentMethods: { label: 'وسائل الدفع', keywords: 'card bank visa wallet account بطاقة بنك', exact: ['cards', 'card', 'payment', 'بطاقات', 'بطاقة'] },
    baseCurrency: { label: 'العملة الأساسية', keywords: 'currency egp usd dollar pound euro عملة جنيه دولار', exact: ['currency', 'عملة'] },
    secondaryCurrency: { label: 'عرض عملة ثانية', keywords: 'secondary also exchange عملة ثانية' },
    onlyMyCurrencies: { label: 'عملاتي فقط في النماذج', keywords: 'hide currencies picker العملات' },
    converter: { label: 'محوّل العملات', keywords: 'rate exchange calculate تحويل' },
    payCycle: { label: 'بداية الشهر', keywords: 'pay cycle salary day payday month start budget راتب يوم الراتب بداية الشهر', exact: ['salary day', 'pay cycle', 'payday', 'يوم الراتب'] },
    household: { label: 'الأسرة والإيجار', keywords: 'family rent home people ايجار اسرة' },
    lifestyle: { label: 'نمط الحياة', keywords: 'food transport habits' },
    budgetEntryMode: { label: 'إدخال الميزانية', keywords: 'percent income amount budget ميزانية نسبة' },
    goldStrip: { label: 'شريط سعر الذهب', keywords: 'xau wealth ذهب' },
    subDueReminders: { label: 'تذكير الاشتراكات', keywords: 'due renew bill notification اشتراك تذكير' },
    subPriceAlerts: { label: 'تنبيهات رفع الأسعار', keywords: 'trial price increase notification سعر' },
    goalProgressAlerts: { label: 'مراحل الأهداف', keywords: 'progress achievement notification هدف' },
    goalAlerts: { label: 'تنبيه التأخر عن الخطة', keywords: 'late goal notification متأخر' },
    pushStatus: { label: 'الإشعارات', keywords: 'push permission allow notification إشعارات' },
    tips: { label: 'نصائح بادجي', keywords: 'nudge suggestion assistant ai نصائح', exact: ['tips', 'نصائح'] },
    learning: { label: 'التعلّم من المحادثات', keywords: 'memory assistant ai تعلم' },
    memories: { label: 'ما يتذكره بادجي', keywords: 'memories forget ذاكرة' },
    voiceReadAloud: { label: 'قراءة الإجابات بصوت عال', keywords: 'voice speak tts mute صوت' },
    sms: { label: 'تتبع الرسائل', keywords: 'bank auto track messages رسائل بنك', exact: ['sms', 'رسائل'] },
    theme: { label: 'المظهر', keywords: 'dark mode light night appearance داكن فاتح وضع الوضع الداكن ليلي', exact: ['dark mode', 'theme', 'dark', 'الوضع الداكن', 'داكن'] },
    language: { label: 'اللغة', keywords: 'arabic english عربي انجليزي لغة', exact: ['language', 'لغة'] },
    showCents: { label: 'إظهار القروش', keywords: 'decimals pennies هللة' },
    exportData: { label: 'تصدير البيانات', keywords: 'backup download csv json نسخة احتياطية', exact: ['export', 'backup', 'تصدير'] },
    restoreBackup: { label: 'استعادة نسخة احتياطية', keywords: 'import upload json استعادة' },
    resetTips: { label: 'إعادة ضبط النصائح', keywords: 'dismissed banners hints' },
    startFresh: { label: 'ابدأ من جديد', keywords: 'delete erase wipe reset data مسح', exact: ['reset', 'delete data', 'مسح'] },
    feedback: { label: 'الإبلاغ عن مشكلة', keywords: 'bug idea feedback support ملاحظات مشكلة', exact: ['feedback', 'bug', 'support'] },
    terms: { label: 'شروط الاستخدام', keywords: 'legal شروط' },
    privacy: { label: 'سياسة الخصوصية', keywords: 'legal data خصوصية' },
  },
  search: {
    noResults: (q) => `مفيش حاجة اسمها «${q}»`,
    noResultsHint: 'جرّب «راتب» أو «داكن» أو «بطاقات».',
    reportMissing: 'قولنا إيه الناقص',
    inRoom: (room) => room,
  },
  menu: { helpFeedback: 'المساعدة والملاحظات', openSettings: 'الإعدادات', signIn: 'تسجيل الدخول', closeMenu: 'إغلاق القائمة', adminPortal: 'لوحة الإدارة' },
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
  payCycle: {
    title: 'دورة الراتب',
    question: 'الشهر عندي يبدأ يوم',
    hint: 'غالبًا يوم نزول الراتب.',
    decrease: 'يوم أبكر',
    increase: 'يوم أبعد',
    today: 'اليوم',
    current: 'دورتك الحالية',
    note: 'الحركات القديمة بتحتفظ بتواريخها، والشهور بتتقسم بشكل مختلف من الآن.',
    paydays: 'أيام الراتب',
    paydaysHint: 'الراتب والإيجار وأي دخل منتظم',
    range: (from, to) => `${from} ← ${to}`,
  },
  you: { account: 'الحساب', security: 'الدخول والأمان', money: 'المال', signedOutHint: 'سجّل الدخول لإدارة حسابك وأمانك.' },
  moneyPage: {
    currency: 'العملة',
    cycle: 'دورة الراتب',
    wallets: 'البطاقات والحسابات',
    rules: 'قواعد الفلوس',
    entryTitle: 'إدخال الميزانية',
    entryAmount: 'مبلغ',
    entryPercent: '٪ من الدخل',
    goldHint: 'سعر الذهب المباشر في الثروة',
    onlyMineHint: 'يخفي بقية العملات من القوائم',
    secondHint: (name) => name,
    paymentMethodsHint: (n) => `${n} بطاقة وحساب`,
    householdHint: 'تساعد بادجي في تقدير ميزانيتك',
    lifestyleHint: 'عادات الأكل والمواصلات',
    converterHint: 'حوّل أي مبلغ',
  },
  alertsPage: {
    master: 'الإشعارات',
    subscriptions: 'الاشتراكات',
    goals: 'الأهداف',
    allowed: 'مسموحة على هذا الجهاز',
    blocked: 'محظورة من إعدادات الهاتف',
    notAsked: 'لم نطلب الإذن بعد',
    unsupported: 'غير متاحة هنا',
    pushHint: 'فعّل الإشعارات من إعدادات الهاتف لتصلك هذه التنبيهات.',
    dueHint: 'قبل التجديد بيوم',
    priceHint: 'عند تغيّر السعر أو انتهاء التجربة',
    progressHint: 'عند ٢٥ و٥٠ و٧٥ و١٠٠٪',
    behindHint: 'فقط عند التأخر، بدون إزعاج',
  },
  buddgyPage: {
    assistant: 'المساعد',
    assistantHint: (tips, learning) => `النصائح ${tips ? 'تعمل' : 'متوقفة'} · التعلّم ${learning ? 'يعمل' : 'متوقف'}`,
    voice: 'قراءة الإجابات بصوت عال',
    voiceHint: 'بادجي بينطق إجاباته في المحادثات الصوتية',
    deviceOnly: 'على هذا الجهاز فقط',
    tracking: 'التتبع التلقائي',
    trackingHint: 'سجّل رسائل البنك كمصروفات',
  },
  lookPage: { appearance: 'المظهر', text: 'اللغة والأرقام', centsHint: 'إظهار المبالغ بالكسور', languageHint: 'الإنجليزية أو العربية' },
  dataPage: {
    tools: 'ترتيب',
    resetTips: 'إعادة ضبط النصائح',
    resetTipsHint: 'إرجاع اللافتات التي أغلقتها',
    resetTipsDone: 'رجعت النصائح واللافتات',
  },
  helpPage: { support: 'الدعم', legal: 'قانوني', about: 'حول', version: 'الإصدار', feedbackHint: 'أخطاء وأفكار وأي شيء' },
}

export const settingsHubCopy: Record<Locale, SettingsHubCopy> = { en, ar }

export function useSettingsHubCopy(): SettingsHubCopy {
  return settingsHubCopy[useLocale().locale]
}
