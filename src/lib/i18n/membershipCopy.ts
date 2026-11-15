import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/**
 * Copy for the Buddget Pro, Sparks, Founders club and weekly check screens (S6 v2 boards).
 * Rules (docs/launch/S6-design-board.md section 3): "Buddget Pro" in Latin letters inside Arabic text; none of the words
 * free trial / web / website / cheaper / checkout / refund in either language (membershipCopy.test.ts); no counters, timers or loss copy.
 */
export interface MembershipCopy {
  mark: string
  proName: string
  hub: { freeLine: string; freeCta: string; trialDay: (day: number, total: number) => string; trialLine: string; renews: string; memberSince: (date: string) => string; ended: string; issue: string; since: string }
  menu: { label: string; renews: string }
  plans: {
    yourPlan: string
    promise: string
    lede: string
    proofAccounts: string
    proofLogged: string
    sample: string
    sampleMessage: string
    sampleRow: string
    privacy: string
    whatProAdds: string
    outcomes: { everyAccount: { t: string; d: string }; wholeYear: { t: string; d: string }; testPlans: { t: string; d: string } }
    compareTitle: string
    compareHead: { label: string; free: string; pro: string }
    compareRows: { label: string; free: string; pro: string }[]
    stayFree: string
    choose: string
    best: string
    yearly: string
    monthly: string
    aYear: string
    aMonth: string
    aboutPerMonth: (price: string) => string
    saving: (pct: number) => string
    monthlyNote: string
    priceHold: string
    makeItRight: string
    howTitle: string
    howYearly: (price: string) => string
    howMonthly: (price: string) => string
    howStore: (store: string) => string
    appStore: string
    playStore: string
    continueYearly: string
    continueMonthly: string
    renewsAutomatically: string
    terms: string
    privacyLink: string
    pricesUnavailable: string
    notOnThisDevice: string
  }
  state: {
    title: string
    plan: string
    period: { monthly: string; yearly: string }
    memberSince: string
    renews: string
    proUntil: string
    ended: string
    planRow: string
    sparksOf: (left: number, total: number) => string
    sparksResets: (date: string) => string
    sparksNote: string
    founderRow: string
    founderHint: string
    included: string
    includedRows: { sms: (n: number) => string; year: string; plans: string; sparks: (sparks: number, estimates: number) => string }
    manage: string
    manageHint: string
    restore: string
    restored: string
    restoreNothing: string
    trial: { chip: string; day: string; movesToFree: string; line: (date: string) => string; soFar: string; accounts: string; logged: string; seePlans: string; noCard: string }
    issue: { chip: string; title: string; body: (date: string) => string; fix: string; lastTry: string }
    expired: { chip: string; title: string; lines: string[]; rejoin: string; rejoinFrom: (price: string) => string; back: string }
    loading: string
    free: string
  }
  sparks: {
    title: string
    ofTotal: (total: number) => string
    resets: (date: string) => string
    costsTitle: string
    costs: { label: string; n: string }[]
    smsFree: string
    resting: (date: string) => string
    restingHint: string
    seePro: string
    count: (n: number) => string
  }
  founders: {
    title: string
    mark: string
    heroLine: string
    yourNumber: string
    perksTitle: string
    perks: { t: string; d: string }[]
    fact: string
    creditsTitle: string
    creditsHint: string
    anon: string
    nameLabel: string
    namePlaceholder: string
    nameSend: string
    nameClear: string
    namePending: string
    nameApproved: string
    share: string
    shareFail: string
    notFounder: string
    betaTitle: string
    betaLine: string
    badge: (number: string) => string
    betaBadge: string
    editNote: string
  }
  week: {
    title: string
    label: string
    hint: string
    lastWeek: string
    thisWeek: string
    keepCta: string
    kept: string
    plusPoints: string
    unconfirmed: (n: number) => string
    review: string
    streak: (weeks: number) => string
    freeze: (n: number) => string
    closed: string
    failed: string
    already: string
    close: string
    noRecord: string
    pending: string
  }
}

const en: MembershipCopy = {
  mark: 'PRO',
  proName: 'Buddget Pro',
  hub: {
    freeLine: 'Every account on autopilot',
    freeCta: 'See what Pro adds',
    trialDay: (day, total) => `Day ${day} of ${total}`,
    trialLine: '14 days of Pro, no card',
    renews: 'Renews',
    memberSince: (date) => `Member since ${date}`,
    ended: 'Ended',
    issue: 'Payment pending',
    since: 'Member since',
  },
  menu: { label: 'Buddget Pro', renews: 'Renews' },
  plans: {
    yourPlan: 'Your plan: Free',
    promise: 'Every account on autopilot. Your whole year in view.',
    lede: 'Buddget Pro reads every bank and wallet you use and keeps all twelve months in one place.',
    proofAccounts: 'free SMS accounts in use',
    proofLogged: 'logged for you this month',
    sample: 'Example',
    sampleMessage: 'Your account ****1234 was debited EGP 180.00 at a pharmacy.',
    sampleRow: 'Pharmacy · Health',
    privacy: 'Only bank and wallet messages are read. Message text is deleted within 60 days. Nothing is sold.',
    whatProAdds: 'What Pro adds',
    outcomes: {
      everyAccount: { t: 'Every account, automatically', d: 'Pro reads SMS from every bank and wallet you use. Free reads 2.' },
      wholeYear: { t: 'The whole year in view', d: 'Any range, trends and the year view. Free shows the last 3 months.' },
      testPlans: { t: 'Plans side by side', d: 'Keep every plan and compare two side by side.' },
    },
    compareTitle: 'Free and Pro, side by side',
    compareHead: { label: '', free: 'Free', pro: 'Buddget Pro' },
    compareRows: [
      { label: 'SMS auto-tracking', free: '2 bank or wallet accounts', pro: 'Every account' },
      { label: 'Reports', free: 'Last 3 months', pro: 'Any range, trends, year view' },
      { label: 'Saved budget plans', free: '2', pro: 'Unlimited' },
      { label: 'Compare plans', free: 'No', pro: 'Yes' },
      { label: 'Live-price estimates', free: '3 a day', pro: '10 a day' },
      { label: 'Sparks for Buddgy', free: '20 a month', pro: '100 a month' },
    ],
    stayFree: 'Free keeps the whole loop: manual entry, budgets, goals, debts and installments, export, two currencies.',
    choose: 'Choose your plan',
    best: 'Best value',
    yearly: 'Yearly',
    monthly: 'Monthly',
    aYear: 'a year',
    aMonth: 'a month',
    aboutPerMonth: (price) => `About ${price} a month.`,
    saving: (pct) => `${pct}% less than 12 monthly payments.`,
    monthlyNote: 'Change or cancel anytime.',
    priceHold: 'Your price won’t rise for 12 months.',
    makeItRight: 'Changed your mind within 30 days of the yearly plan? We’ll make it right.',
    howTitle: 'How it works',
    howYearly: (price) => `Buddget Pro renews automatically at ${price} a year until you cancel.`,
    howMonthly: (price) => `Buddget Pro renews automatically at ${price} a month until you cancel.`,
    howStore: (store) => `Cancel anytime in your ${store} settings, at least 24 hours before the renewal date. Payment is taken by your ${store} account.`,
    appStore: 'App Store',
    playStore: 'Google Play',
    continueYearly: 'Continue with yearly',
    continueMonthly: 'Continue with monthly',
    renewsAutomatically: 'renews automatically',
    terms: 'Terms',
    privacyLink: 'Privacy',
    pricesUnavailable: 'Prices are not available right now. Try again shortly.',
    notOnThisDevice: 'Plans are chosen in the iOS or Android app.',
  },
  state: {
    title: 'Your plan',
    plan: 'Plan',
    period: { monthly: 'Monthly', yearly: 'Yearly' },
    memberSince: 'Member since',
    renews: 'Renews',
    proUntil: 'Pro until',
    ended: 'Ended',
    planRow: 'Plan',
    sparksOf: (left, total) => `${left} of ${total} Sparks`,
    sparksResets: (date) => `Resets ${date}. SMS never uses Sparks.`,
    sparksNote: 'SMS auto-tracking never uses Sparks.',
    founderRow: 'Founders club',
    founderHint: 'Your number and perks. It doesn’t change your plan.',
    included: 'In your Pro',
    includedRows: {
      sms: (n) => (n > 1 ? `SMS on all ${n} accounts` : 'SMS on every account'),
      year: 'The whole year in reports',
      plans: 'Unlimited plans and side-by-side compare',
      sparks: (sparks, estimates) => `${sparks} Sparks and ${estimates} live-price estimates a day`,
    },
    manage: 'Manage in the store',
    manageHint: 'Change plan or cancel',
    restore: 'Restore purchases',
    restored: 'Checked. Your plan is up to date.',
    restoreNothing: 'No purchase found for this store account.',
    trial: {
      chip: '14 days of Pro, no card',
      day: 'Day',
      movesToFree: 'Moves to Free',
      line: (date) => `On ${date} you move to Free. Nothing is charged and nothing is deleted.`,
      soFar: 'So far, Pro has',
      accounts: 'accounts read',
      logged: 'logged for you',
      seePlans: 'See plans',
      noCard: 'No card needed until you choose.',
    },
    issue: {
      chip: 'Payment pending',
      title: 'The store couldn’t take this payment.',
      body: (date) => `You keep Pro until ${date} while it tries again. Nothing changes until then.`,
      fix: 'Update payment in the store',
      lastTry: 'Pro until',
    },
    expired: {
      chip: 'Ended',
      title: 'You’re on Free now. Nothing was deleted.',
      lines: ['SMS reads 2 accounts. Messages from other accounts wait for you for 30 days.', 'All your history is kept. Reports show the last 3 months.', 'Saved plans beyond 2 are read-only. Your active plan works as before.'],
      rejoin: 'Rejoin Buddget Pro',
      rejoinFrom: (price) => `Rejoin from ${price} a year`,
      back: 'Everything comes back on, as you left it.',
    },
    loading: 'Loading your plan…',
    free: 'No subscription',
  },
  sparks: {
    title: 'Sparks',
    ofTotal: (total) => `of ${total}`,
    resets: (date) => `Resets ${date}`,
    costsTitle: 'What each action costs',
    costs: [
      { label: 'A Buddgy reply', n: '1' },
      { label: 'A voice message', n: '1' },
      { label: 'A receipt scan', n: '2' },
      { label: 'A budget suggestion', n: '2' },
      { label: 'A goal estimate', n: '1' },
      { label: 'A live-price estimate', n: '10' },
      { label: 'SMS auto-tracking', n: '0' },
    ],
    smsFree: 'SMS auto-tracking never uses Sparks.',
    resting: (date) => `Buddgy is resting until ${date}`,
    restingHint: 'Everything except AI replies still works.',
    seePro: 'See Pro',
    count: (n) => `${n} left`,
  },
  founders: {
    title: 'Founders club',
    mark: 'FOUNDER',
    heroLine: 'Earned by using Buddget in its first weeks. Never bought.',
    yourNumber: 'Your number',
    perksTitle: 'What founders get',
    perks: [
      { t: 'Your number', d: 'A founder number that stays yours.' },
      { t: 'Your name on the credits', d: 'If you want it. We approve each name first.' },
      { t: 'A say in what we build', d: 'Founders are asked first when we test something new.' },
    ],
    fact: 'At most 100 founders. The window closes 60 days after launch.',
    creditsTitle: 'Credits',
    creditsHint: 'Founders, in number order. A name appears only after you ask for it and we approve it.',
    anon: 'Founder',
    nameLabel: 'Name on the credits',
    namePlaceholder: 'The name you want shown',
    nameSend: 'Ask to be listed',
    nameClear: 'Remove my name',
    namePending: 'Waiting for approval.',
    nameApproved: 'Your name is on the list.',
    share: 'Share your founder card',
    shareFail: 'Couldn’t make the image. Try again.',
    notFounder: 'The Founders club is for the first users who earned a place.',
    betaTitle: 'Beta tester',
    betaLine: 'You helped test Buddget before launch. Thank you.',
    badge: (number) => `Founder ${number}`,
    betaBadge: 'Beta tester',
    editNote: 'You can change this any time.',
  },
  week: {
    title: 'Your week',
    label: 'Check your week',
    hint: 'A minute to keep your streak',
    lastWeek: 'Last week',
    thisWeek: 'This week',
    keepCta: 'Keep this week',
    kept: 'Week kept',
    plusPoints: '+10 points',
    unconfirmed: (n) => `${n} messages still need a look`,
    review: 'Review them',
    streak: (weeks) => `${weeks} weeks in a row`,
    freeze: (n) => `${n} freeze banked`,
    closed: 'This week is closed.',
    failed: 'Couldn’t keep this week. Try again.',
    already: 'This week is already kept.',
    close: 'Close',
    noRecord: 'No records this week. Your streak is kept.',
    pending: 'Keeping…',
  },
}

const ar: MembershipCopy = {
  mark: 'PRO',
  proName: 'Buddget Pro',
  hub: {
    freeLine: 'كل حساباتك على الوضع التلقائي',
    freeCta: 'شاهد ما يضيفه Pro',
    trialDay: (day, total) => `اليوم ${day} من ${total}`,
    trialLine: '14 يوماً من Pro بلا بطاقة',
    renews: 'يتجدد',
    memberSince: (date) => `عضو منذ ${date}`,
    ended: 'انتهى',
    issue: 'الدفع معلّق',
    since: 'عضو منذ',
  },
  menu: { label: 'Buddget Pro', renews: 'يتجدد' },
  plans: {
    yourPlan: 'خطتك: المجاني',
    promise: 'كل حساباتك على الوضع التلقائي. وعامك كله أمامك.',
    lede: 'Buddget Pro يقرأ كل بنك ومحفظة تستخدمها ويجمع الاثني عشر شهراً في مكان واحد.',
    proofAccounts: 'حسابات SMS المجانية مستخدمة',
    proofLogged: 'سُجلت لك هذا الشهر',
    sample: 'مثال',
    sampleMessage: 'تم خصم 180.00 جنيه من حسابك ****1234 في صيدلية.',
    sampleRow: 'صيدلية · الصحة',
    privacy: 'تُقرأ رسائل البنوك والمحافظ فقط. يُحذف نص الرسالة خلال 60 يوماً. لا نبيع أي بيانات.',
    whatProAdds: 'ماذا يضيف Pro',
    outcomes: {
      everyAccount: { t: 'كل حساب، تلقائياً', d: 'يقرأ Pro رسائل كل بنك ومحفظة تستخدمها. المجاني يقرأ حسابين.' },
      wholeYear: { t: 'العام كله أمامك', d: 'أي فترة، الاتجاهات وعرض السنة. المجاني يعرض آخر 3 أشهر.' },
      testPlans: { t: 'خطط جنباً إلى جنب', d: 'احتفظ بكل خططك وقارن بين خطتين.' },
    },
    compareTitle: 'المجاني وPro جنباً إلى جنب',
    compareHead: { label: '', free: 'المجاني', pro: 'Buddget Pro' },
    compareRows: [
      { label: 'تتبع SMS التلقائي', free: 'حسابان بنكيان أو محفظتان', pro: 'كل الحسابات' },
      { label: 'التقارير', free: 'آخر 3 أشهر', pro: 'أي فترة، اتجاهات، عرض السنة' },
      { label: 'خطط الميزانية المحفوظة', free: '2', pro: 'بلا حد' },
      { label: 'مقارنة الخطط', free: 'لا', pro: 'نعم' },
      { label: 'تقديرات بالأسعار الحية', free: '3 يومياً', pro: '10 يومياً' },
      { label: 'Sparks لـ Buddgy', free: '20 شهرياً', pro: '100 شهرياً' },
    ],
    stayFree: 'المجاني يحتفظ بالدورة كاملة: الإدخال اليدوي، الميزانيات، الأهداف، الديون والأقساط، التصدير، وعملتان.',
    choose: 'اختر خطتك',
    best: 'القيمة الأفضل',
    yearly: 'سنوي',
    monthly: 'شهري',
    aYear: 'سنوياً',
    aMonth: 'شهرياً',
    aboutPerMonth: (price) => `حوالي ${price} شهرياً.`,
    saving: (pct) => `أقل بنسبة ${pct}% من 12 دفعة شهرية.`,
    monthlyNote: 'غيّر أو ألغِ في أي وقت.',
    priceHold: 'سعرك لن يرتفع لمدة 12 شهراً.',
    makeItRight: 'غيّرت رأيك خلال 30 يوماً من الاشتراك السنوي؟ سنتولى الأمر.',
    howTitle: 'كيف يعمل ذلك',
    howYearly: (price) => `يتجدد Buddget Pro تلقائياً بسعر ${price} سنوياً حتى تلغيه.`,
    howMonthly: (price) => `يتجدد Buddget Pro تلقائياً بسعر ${price} شهرياً حتى تلغيه.`,
    howStore: (store) => `يمكنك الإلغاء في أي وقت من إعدادات ${store} قبل موعد التجديد بـ 24 ساعة على الأقل. يتم الدفع من حساب ${store}.`,
    appStore: 'App Store',
    playStore: 'Google Play',
    continueYearly: 'المتابعة بالاشتراك السنوي',
    continueMonthly: 'المتابعة بالاشتراك الشهري',
    renewsAutomatically: 'يتجدد تلقائياً',
    terms: 'الشروط',
    privacyLink: 'الخصوصية',
    pricesUnavailable: 'الأسعار غير متاحة الآن. حاول بعد قليل.',
    notOnThisDevice: 'تُختار الخطط من تطبيق iOS أو Android.',
  },
  state: {
    title: 'خطتك',
    plan: 'الخطة',
    period: { monthly: 'شهري', yearly: 'سنوي' },
    memberSince: 'عضو منذ',
    renews: 'يتجدد',
    proUntil: 'Pro حتى',
    ended: 'انتهى',
    planRow: 'الخطة',
    sparksOf: (left, total) => `${left} من ${total} Sparks`,
    sparksResets: (date) => `تتجدد ${date}. رسائل SMS لا تستهلك Sparks.`,
    sparksNote: 'تتبع SMS التلقائي لا يستهلك Sparks أبداً.',
    founderRow: 'نادي المؤسسين',
    founderHint: 'رقمك ومزاياك. لا يغيّر خطتك.',
    included: 'ما يتضمنه Pro',
    includedRows: {
      sms: (n) => (n > 1 ? `SMS على كل الحسابات الـ ${n}` : 'SMS على كل حساباتك'),
      year: 'العام كله في التقارير',
      plans: 'خطط بلا حد ومقارنة جنباً إلى جنب',
      sparks: (sparks, estimates) => `${sparks} Sparks و${estimates} تقديرات بالأسعار الحية يومياً`,
    },
    manage: 'الإدارة في المتجر',
    manageHint: 'تغيير الخطة أو الإلغاء',
    restore: 'استعادة المشتريات',
    restored: 'تم التحقق. خطتك محدّثة.',
    restoreNothing: 'لا توجد عملية شراء لحساب المتجر هذا.',
    trial: {
      chip: '14 يوماً من Pro بلا بطاقة',
      day: 'اليوم',
      movesToFree: 'الانتقال إلى المجاني',
      line: (date) => `في ${date} تنتقل إلى المجاني. لا يُخصم شيء ولا يُحذف شيء.`,
      soFar: 'حتى الآن، Pro',
      accounts: 'حسابات مقروءة',
      logged: 'سُجلت لك',
      seePlans: 'شاهد الخطط',
      noCard: 'لا حاجة لبطاقة حتى تختار.',
    },
    issue: {
      chip: 'الدفع معلّق',
      title: 'تعذّر على المتجر سحب هذه الدفعة.',
      body: (date) => `تحتفظ بـ Pro حتى ${date} بينما يعيد المتجر المحاولة. لا يتغير شيء حتى ذلك الحين.`,
      fix: 'حدّث الدفع في المتجر',
      lastTry: 'Pro حتى',
    },
    expired: {
      chip: 'انتهى',
      title: 'أنت على المجاني الآن. لم يُحذف شيء.',
      lines: ['SMS يقرأ حسابين. رسائل الحسابات الأخرى تنتظرك 30 يوماً.', 'كل سجلك محفوظ. التقارير تعرض آخر 3 أشهر.', 'الخطط المحفوظة بعد الثانية للقراءة فقط. خطتك النشطة تعمل كما كانت.'],
      rejoin: 'انضم إلى Buddget Pro من جديد',
      rejoinFrom: (price) => `انضم من جديد بسعر ${price} سنوياً`,
      back: 'يعود كل شيء كما تركته.',
    },
    loading: 'جارٍ تحميل خطتك…',
    free: 'لا يوجد اشتراك',
  },
  sparks: {
    title: 'Sparks',
    ofTotal: (total) => `من ${total}`,
    resets: (date) => `تتجدد ${date}`,
    costsTitle: 'تكلفة كل إجراء',
    costs: [
      { label: 'رد من Buddgy', n: '1' },
      { label: 'رسالة صوتية', n: '1' },
      { label: 'مسح إيصال', n: '2' },
      { label: 'اقتراح للميزانية', n: '2' },
      { label: 'تقدير هدف', n: '1' },
      { label: 'تقدير بالسعر الحي', n: '10' },
      { label: 'تتبع SMS التلقائي', n: '0' },
    ],
    smsFree: 'تتبع SMS التلقائي لا يستهلك Sparks أبداً.',
    resting: (date) => `Buddgy في راحة حتى ${date}`,
    restingHint: 'كل شيء يعمل عدا ردود الذكاء الاصطناعي.',
    seePro: 'شاهد Pro',
    count: (n) => `متبقٍّ ${n}`,
  },
  founders: {
    title: 'نادي المؤسسين',
    mark: 'مؤسس',
    heroLine: 'يُكتسب باستخدام Buddget في أسابيعه الأولى. لا يُشترى أبداً.',
    yourNumber: 'رقمك',
    perksTitle: 'ما يحصل عليه المؤسسون',
    perks: [
      { t: 'رقمك', d: 'رقم مؤسس يبقى لك.' },
      { t: 'اسمك في قائمة الشكر', d: 'إن أردت. نراجع كل اسم أولاً.' },
      { t: 'رأي فيما نبنيه', d: 'نسأل المؤسسين أولاً عند اختبار أي جديد.' },
    ],
    fact: 'حتى 100 مؤسس كحد أقصى. تُغلق المهلة بعد 60 يوماً من الإطلاق.',
    creditsTitle: 'قائمة الشكر',
    creditsHint: 'المؤسسون بترتيب الأرقام. لا يظهر اسم إلا بعد أن تطلبه ونوافق عليه.',
    anon: 'مؤسس',
    nameLabel: 'الاسم في قائمة الشكر',
    namePlaceholder: 'الاسم الذي تريد عرضه',
    nameSend: 'اطلب الإدراج',
    nameClear: 'احذف اسمي',
    namePending: 'بانتظار الموافقة.',
    nameApproved: 'اسمك في القائمة.',
    share: 'شارك بطاقة المؤسس',
    shareFail: 'تعذّر إنشاء الصورة. حاول مرة أخرى.',
    notFounder: 'نادي المؤسسين للمستخدمين الأوائل الذين اكتسبوا مكانهم.',
    betaTitle: 'مختبر تجريبي',
    betaLine: 'ساعدت في اختبار Buddget قبل الإطلاق. شكراً لك.',
    badge: (number) => `مؤسس ${number}`,
    betaBadge: 'مختبر تجريبي',
    editNote: 'يمكنك تغيير ذلك في أي وقت.',
  },
  week: {
    title: 'أسبوعك',
    label: 'راجع أسبوعك',
    hint: 'دقيقة للحفاظ على سلسلتك',
    lastWeek: 'الأسبوع الماضي',
    thisWeek: 'هذا الأسبوع',
    keepCta: 'احتفظ بهذا الأسبوع',
    kept: 'تم حفظ الأسبوع',
    plusPoints: '+10 نقاط',
    unconfirmed: (n) => `${n} رسائل تحتاج إلى نظرة`,
    review: 'راجعها',
    streak: (weeks) => `${weeks} أسابيع متتالية`,
    freeze: (n) => `${n} تجميد محفوظ`,
    closed: 'هذا الأسبوع مغلق.',
    failed: 'تعذّر حفظ هذا الأسبوع. حاول مرة أخرى.',
    already: 'تم حفظ هذا الأسبوع من قبل.',
    close: 'إغلاق',
    noRecord: 'لا سجلات هذا الأسبوع. سلسلتك محفوظة.',
    pending: 'جارٍ الحفظ…',
  },
}

export const membershipCopy: Record<Locale, MembershipCopy> = { en, ar }

export function useMembershipCopy(): MembershipCopy {
  const { locale } = useLocale()
  return membershipCopy[locale]
}
