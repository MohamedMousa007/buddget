import { useLocale } from '@/lib/i18n'
import { arCount } from '@/lib/i18n/arPlural'
import type { Locale } from '@/lib/i18n/types'

/**
 * Copy for the buddget Pro, Sparks, Founders club and weekly check screens (S6 v2 boards).
 * Rules (docs/launch/S6-design-board.md section 3): "buddget Pro" in Latin letters inside Arabic text; none of the words
 * free trial / web / website / cheaper / checkout / refund in either language (membershipCopy.test.ts); no counters, timers or loss copy.
 */
export interface MembershipCopy {
  mark: string
  proName: string
  hub: { freeLine: string; freeCta: string; trialDay: (day: number, total: number) => string; trialLine: string; renews: string; memberSince: (date: string) => string; ended: string; issue: string; since: string }
  menu: { label: string; renews: string }
  row: { name: string; trialName: string; freeSub: string; freeMenuSub: string; renews: (date: string) => string; ends: (date: string) => string; trialLeft: (days: number) => string; issueSub: string; endedSub: (date: string) => string; tryFree: string; keepPro: string; fix: string; restart: string }
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
    outcomes: { moreAi: { t: string; d: string }; advisor: { t: string; d: string }; noLimits: { t: string; d: string } }
    compareTitle: string
    compareHead: { label: string; free: string; pro: string }
    compareRows: { label: string; free: string; pro: string }[]
    stayFree: string
    comingSoon: { title: string; partner: string; insights: string; notify: string; noted: string }
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
  welcome: { title: string; back: string; rows: [string, string, string]; price: string; start: string }
  billing: {
    title: string
    section: string
    billedBy: string
    cancelRow: string
    cancelInStore: string
    cancelHandoff: (store: string, date: string | null) => string
    stay: {
      titleMonthly: string
      titleAnnual: string
      keep: (weeks: number, tier: string | null) => string
      cta: string
      cancelAnyway: string
      done: string
      failed: string
    }
    restore: string
    purchases: string
    seeAll: string
    problem: string
    none: string
    noneHint: string
    sparksOf: (n: number) => string
    proYearly: string
    proMonthly: string
    loadError: string
    tryAgain: string
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
    trial: { tryTitle: string; tries: [string, string, string]; chip: string; day: string; movesToFree: string; line: (date: string) => string; soFar: string; accounts: string; logged: string; seePlans: string; noCard: string }
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
  proName: 'buddget Pro',
  hub: {
    freeLine: 'Every account on autopilot',
    freeCta: 'See what Pro adds',
    trialDay: (day, total) => `Day ${day} of ${total}`,
    trialLine: '30 days of Pro, no card',
    renews: 'Renews',
    memberSince: (date) => `Member since ${date}`,
    ended: 'Ended',
    issue: 'Payment pending',
    since: 'Member since',
  },
  menu: { label: 'Plan and billing', renews: 'Renews' },
  row: {
    name: 'buddget Pro',
    trialName: 'Pro trial',
    freeSub: 'More Buddgy, unlimited budgets',
    freeMenuSub: '30 days free, no card',
    renews: (date) => `Renews ${date}`,
    ends: (date) => `Ends ${date}`,
    trialLeft: (days) => (days <= 1 ? 'Ends today' : `Ends in ${days} days`),
    issueSub: 'Payment didn’t go through',
    endedSub: (date) => `Ended ${date}`,
    tryFree: 'Try free',
    keepPro: 'Keep Pro',
    fix: 'Fix',
    restart: 'Restart',
  },
  plans: {
    yourPlan: 'Your plan: Free',
    promise: 'Your money on autopilot. Buddgy does the work.',
    lede: 'About 10x the AI, the Advisor and unlimited plans.',
    proofAccounts: 'free SMS accounts in use',
    proofLogged: 'logged for you this month',
    sample: 'Example',
    sampleMessage: 'Your account ****1234 was debited EGP 180.00 at a pharmacy.',
    sampleRow: 'Pharmacy · Health',
    privacy: 'Only bank and wallet messages are read. Message text is deleted within 60 days. Nothing is sold.',
    whatProAdds: 'What Pro adds',
    outcomes: {
      moreAi: { t: 'About 10x the AI', d: 'Ask Buddgy, scan receipts, send voice messages and build budgets without watching a limit.' },
      advisor: { t: 'A smarter Buddgy', d: 'The Advisor, the reasoning model for planning and “what should I do” questions. Pro only.' },
      noLimits: { t: 'Plan without limits', d: 'Keep every budget plan and check your bank-confirmed balances as often as you like.' },
    },
    compareTitle: 'Free and Pro, side by side',
    compareHead: { label: '', free: 'Free', pro: 'buddget Pro' },
    compareRows: [
      { label: 'SMS auto-tracking', free: 'Every account', pro: 'Every account' },
      { label: 'Live balance views', free: '10 a month', pro: 'Unlimited' },
      { label: 'Buddgy chat, receipts, voice, budget builder', free: 'Yes, limited', pro: 'Yes, about 10x more' },
      { label: 'Buddgy Advisor', free: '1 free answer a month', pro: 'Yes' },
      { label: 'Saved budget plans', free: '2', pro: 'Unlimited' },
      { label: 'Sparks for extra AI', free: 'Standard packs', pro: '25% more per pack' },
    ],
    stayFree: 'SMS tracking on every account, free forever. Free also keeps reports, export, goals, debts and installments.',
    comingSoon: { title: 'Coming soon to Pro', partner: 'Share a budget with your partner', insights: 'Advanced insights', notify: 'Notify me', noted: 'We’ll let you know' },
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
    howYearly: (price) => `buddget Pro renews automatically at ${price} a year until you cancel.`,
    howMonthly: (price) => `buddget Pro renews automatically at ${price} a month until you cancel.`,
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
  welcome: { title: 'Welcome to buddget Pro', back: 'Welcome back to buddget Pro', rows: ['About 10x the AI for chat, voice and scans', 'The Advisor for the big questions', 'Unlimited plans and live balance views'], price: 'Your price stays the same for 12 months.', start: 'Start using Pro' },
  billing: {
    title: 'Plan and billing',
    section: 'Billing and purchases',
    billedBy: 'Billed by',
    cancelRow: 'Cancel subscription',
    cancelInStore: 'Cancel in store',
    cancelHandoff: (store, date) => (date ? `You finish cancelling in ${store}. You keep Pro until ${date}.` : `You finish cancelling in ${store}.`),
    stay: {
      titleMonthly: 'Stay with Pro: 30% off your next 2 months',
      titleAnnual: 'Stay with Pro: 20% off your next year',
      keep: (weeks, tier) => (weeks > 0 ? `You keep your ${weeks}-week streak${tier ? `, your ${tier} progress` : ''} and all your Pro limits.` : `You keep your ${tier ? `${tier} progress, your ` : ''}points and all your Pro limits.`),
      cta: 'Stay with Pro',
      cancelAnyway: 'Cancel anyway',
      done: 'Done. The offer is on your next bill.',
      failed: 'The store did not finish the offer. Try again, or cancel below.',
    },
    restore: 'Restore purchases',
    purchases: 'Purchases in buddget',
    seeAll: 'See all',
    problem: 'Problem with a purchase?',
    none: 'No purchases yet',
    noneHint: 'Pro and Sparks you buy show here.',
    sparksOf: (n) => `${n} Sparks`,
    proYearly: 'buddget Pro, yearly',
    proMonthly: 'buddget Pro, monthly',
    loadError: 'Couldn’t load your purchases. Your plan details are still shown.',
    tryAgain: 'Try again',
  },
  state: {
    title: 'Plan and billing',
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
    restoreNothing: 'Nothing to restore.',
    trial: {
      tryTitle: 'You have buddget Pro for 30 days',
      tries: ['Ask the Advisor a money question', 'Scan a receipt', 'Send Buddgy a voice message'],
      chip: '30 days of Pro, no card',
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
      lines: ['SMS reads 2 accounts. Messages from other accounts wait for you for 30 days.', 'All your history is kept. Insights show the last 6 months.', 'Saved plans beyond 2 are read-only. Your active plan works as before.'],
      rejoin: 'Rejoin buddget Pro',
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
    heroLine: 'Earned by using buddget in its first weeks. Never bought.',
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
    betaLine: 'You helped test buddget before launch. Thank you.',
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
  proName: 'بادجت برو',
  hub: {
    freeLine: 'كل حساباتك على الوضع التلقائي',
    freeCta: 'شاهد ما يضيفه برو',
    trialDay: (day, total) => `اليوم ${day} من ${total}`,
    trialLine: '30 يوماً من برو بلا بطاقة',
    renews: 'يتجدد',
    memberSince: (date) => `عضو منذ ${date}`,
    ended: 'انتهى',
    issue: 'الدفع معلّق',
    since: 'عضو منذ',
  },
  menu: { label: 'الخطة والفوترة', renews: 'يتجدد' },
  row: {
    name: 'بادجت برو',
    trialName: 'تجربة برو',
    freeSub: 'بادجي أكثر وميزانيات بلا حد',
    freeMenuSub: '30 يوماً مجاناً بلا بطاقة',
    renews: (date) => `يتجدد ${date}`,
    ends: (date) => `ينتهي ${date}`,
    trialLeft: (days) => (days <= 1 ? 'ينتهي اليوم' : `ينتهي خلال ${arCount(days, 'day')}`),
    issueSub: 'لم تتم عملية الدفع',
    endedSub: (date) => `انتهى ${date}`,
    tryFree: 'جرّب مجاناً',
    keepPro: 'استمر مع برو',
    fix: 'إصلاح',
    restart: 'ابدأ من جديد',
  },
  plans: {
    yourPlan: 'خطتك: المجاني',
    promise: 'أموالك على الوضع التلقائي. بادجي يقوم بالعمل.',
    lede: 'حوالي 10 أضعاف الذكاء الاصطناعي، والمستشار، وخطط بلا حد.',
    proofAccounts: 'حسابات SMS المجانية مستخدمة',
    proofLogged: 'سُجلت لك هذا الشهر',
    sample: 'مثال',
    sampleMessage: 'تم خصم 180.00 جنيه من حسابك ****1234 في صيدلية.',
    sampleRow: 'صيدلية · الصحة',
    privacy: 'تُقرأ رسائل البنوك والمحافظ فقط. يُحذف نص الرسالة خلال 60 يوماً. لا نبيع أي بيانات.',
    whatProAdds: 'ماذا يضيف برو',
    outcomes: {
      moreAi: { t: 'حوالي 10 أضعاف الذكاء الاصطناعي', d: 'اسأل بادجي وامسح الإيصالات وأرسل رسائل صوتية وابنِ ميزانيات دون مراقبة أي حد.' },
      advisor: { t: 'بادجي أذكى', d: 'المستشار، نموذج التفكير للتخطيط وأسئلة «ماذا أفعل». في برو فقط.' },
      noLimits: { t: 'خطط بلا حدود', d: 'احتفظ بكل خطط الميزانية وراجع أرصدتك المؤكدة من البنك كلما أردت.' },
    },
    compareTitle: 'المجاني وبرو جنباً إلى جنب',
    compareHead: { label: '', free: 'المجاني', pro: 'بادجت برو' },
    compareRows: [
      { label: 'تتبع SMS التلقائي', free: 'كل الحسابات', pro: 'كل الحسابات' },
      { label: 'عروض الرصيد المباشر', free: '10 شهرياً', pro: 'بلا حد' },
      { label: 'محادثة بادجي والإيصالات والصوت وبناء الميزانية', free: 'نعم، بحد', pro: 'نعم، حوالي 10 أضعاف' },
      { label: 'مستشار بادجي', free: 'إجابة مجانية واحدة شهرياً', pro: 'نعم' },
      { label: 'خطط الميزانية المحفوظة', free: '2', pro: 'بلا حد' },
      { label: 'شرارات للذكاء الاصطناعي الإضافي', free: 'الباقات العادية', pro: '25% إضافية في كل باقة' },
    ],
    stayFree: 'تتبع SMS على كل حساب، مجاناً للأبد. والمجاني يحتفظ أيضاً بالتحليلات والتصدير والأهداف والديون والأقساط.',
    comingSoon: { title: 'قريباً في برو', partner: 'شارك ميزانية مع شريكك', insights: 'رؤى متقدمة', notify: 'أخبرني', noted: 'سنخبرك' },
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
    howYearly: (price) => `يتجدد بادجت برو تلقائياً بسعر ${price} سنوياً حتى تلغيه.`,
    howMonthly: (price) => `يتجدد بادجت برو تلقائياً بسعر ${price} شهرياً حتى تلغيه.`,
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
  welcome: { title: 'أهلاً بك في بادجت برو', back: 'أهلاً بعودتك إلى بادجت برو', rows: ['حوالي 10 أضعاف الذكاء الاصطناعي للمحادثة والصوت والمسح', 'المستشار للأسئلة الكبيرة', 'خطط وعروض رصيد مباشر بلا حد'], price: 'سعرك يبقى كما هو لمدة 12 شهراً.', start: 'ابدأ استخدام برو' },
  billing: {
    title: 'الخطة والفوترة',
    section: 'الفوترة والمشتريات',
    billedBy: 'الفوترة عبر',
    cancelRow: 'إلغاء الاشتراك',
    cancelInStore: 'الإلغاء في المتجر',
    cancelHandoff: (store, date) => (date ? `تكمل الإلغاء في ${store}. تحتفظ ببرو حتى ${date}.` : `تكمل الإلغاء في ${store}.`),
    stay: {
      titleMonthly: 'ابقَ مع برو: خصم 30% على الشهرين القادمين',
      titleAnnual: 'ابقَ مع برو: خصم 20% على سنتك القادمة',
      keep: (weeks, tier) => (weeks > 0 ? `تحتفظ بسلسلتك (${weeks} أسابيع)${tier ? ` وتقدّمك في ${tier}` : ''} وكل حدود برو.` : `تحتفظ ${tier ? `بتقدّمك في ${tier} و` : 'ب'}نقاطك وكل حدود برو.`),
      cta: 'ابقَ مع برو',
      cancelAnyway: 'إلغاء على أي حال',
      done: 'تم. الخصم على فاتورتك القادمة.',
      failed: 'لم يكمل المتجر العرض. حاول مرة أخرى أو ألغِ أدناه.',
    },
    restore: 'استعادة المشتريات',
    purchases: 'المشتريات في بادجت',
    seeAll: 'عرض الكل',
    problem: 'مشكلة في عملية شراء؟',
    none: 'لا مشتريات بعد',
    noneHint: 'ما تشتريه من برو وشرارات يظهر هنا.',
    sparksOf: (n) => `${n} شرارة`,
    proYearly: 'بادجت برو، سنوي',
    proMonthly: 'بادجت برو، شهري',
    loadError: 'تعذّر تحميل مشترياتك. تفاصيل خطتك ما زالت معروضة.',
    tryAgain: 'حاول مجدداً',
  },
  state: {
    title: 'الخطة والفوترة',
    plan: 'الخطة',
    period: { monthly: 'شهري', yearly: 'سنوي' },
    memberSince: 'عضو منذ',
    renews: 'يتجدد',
    proUntil: 'برو حتى',
    ended: 'انتهى',
    planRow: 'الخطة',
    sparksOf: (left, total) => `${left} من ${total} شرارة`,
    sparksResets: (date) => `تتجدد ${date}. رسائل SMS لا تستهلك شرارات.`,
    sparksNote: 'تتبع SMS التلقائي لا يستهلك شرارات أبداً.',
    founderRow: 'نادي المؤسسين',
    founderHint: 'رقمك ومزاياك. لا يغيّر خطتك.',
    included: 'ما يتضمنه برو',
    includedRows: {
      sms: (n) => (n > 1 ? `SMS على كل الحسابات الـ ${n}` : 'SMS على كل حساباتك'),
      year: 'العام كله في التحليلات',
      plans: 'خطط بلا حد ومقارنة جنباً إلى جنب',
      sparks: (sparks, estimates) => `${sparks} شرارة و${estimates} تقديرات بالأسعار الحية يومياً`,
    },
    manage: 'الإدارة في المتجر',
    manageHint: 'تغيير الخطة أو الإلغاء',
    restore: 'استعادة المشتريات',
    restored: 'تم التحقق. خطتك محدّثة.',
    restoreNothing: 'لا يوجد ما يُستعاد.',
    trial: {
      tryTitle: 'لديك بادجت برو لمدة 30 يوماً',
      tries: ['اسأل المستشار سؤالاً عن المال', 'امسح إيصالاً', 'أرسل لبادجي رسالة صوتية'],
      chip: '30 يوماً من برو بلا بطاقة',
      day: 'اليوم',
      movesToFree: 'الانتقال إلى المجاني',
      line: (date) => `في ${date} تنتقل إلى المجاني. لا يُخصم شيء ولا يُحذف شيء.`,
      soFar: 'حتى الآن، برو',
      accounts: 'حسابات مقروءة',
      logged: 'سُجلت لك',
      seePlans: 'شاهد الخطط',
      noCard: 'لا حاجة لبطاقة حتى تختار.',
    },
    issue: {
      chip: 'الدفع معلّق',
      title: 'تعذّر على المتجر سحب هذه الدفعة.',
      body: (date) => `تحتفظ ببرو حتى ${date} بينما يعيد المتجر المحاولة. لا يتغير شيء حتى ذلك الحين.`,
      fix: 'حدّث الدفع في المتجر',
      lastTry: 'برو حتى',
    },
    expired: {
      chip: 'انتهى',
      title: 'أنت على المجاني الآن. لم يُحذف شيء.',
      lines: ['SMS يقرأ حسابين. رسائل الحسابات الأخرى تنتظرك 30 يوماً.', 'كل سجلك محفوظ. التحليلات تعرض آخر 6 أشهر.', 'الخطط المحفوظة بعد الثانية للقراءة فقط. خطتك النشطة تعمل كما كانت.'],
      rejoin: 'انضم إلى بادجت برو من جديد',
      rejoinFrom: (price) => `انضم من جديد بسعر ${price} سنوياً`,
      back: 'يعود كل شيء كما تركته.',
    },
    loading: 'جارٍ تحميل خطتك…',
    free: 'لا يوجد اشتراك',
  },
  sparks: {
    title: 'شرارات',
    ofTotal: (total) => `من ${total}`,
    resets: (date) => `تتجدد ${date}`,
    costsTitle: 'تكلفة كل إجراء',
    costs: [
      { label: 'رد من بادجي', n: '1' },
      { label: 'رسالة صوتية', n: '1' },
      { label: 'مسح إيصال', n: '2' },
      { label: 'اقتراح للميزانية', n: '2' },
      { label: 'تقدير هدف', n: '1' },
      { label: 'تقدير بالسعر الحي', n: '10' },
      { label: 'تتبع SMS التلقائي', n: '0' },
    ],
    smsFree: 'تتبع SMS التلقائي لا يستهلك شرارات أبداً.',
    resting: (date) => `بادجي في راحة حتى ${date}`,
    restingHint: 'كل شيء يعمل عدا ردود الذكاء الاصطناعي.',
    seePro: 'شاهد برو',
    count: (n) => `متبقٍّ ${n}`,
  },
  founders: {
    title: 'نادي المؤسسين',
    mark: 'مؤسس',
    heroLine: 'يُكتسب باستخدام بادجت في أسابيعه الأولى. لا يُشترى أبداً.',
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
    betaLine: 'ساعدت في اختبار بادجت قبل الإطلاق. شكراً لك.',
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
