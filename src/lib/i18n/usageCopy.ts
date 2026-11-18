import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { NoticeKey } from '@/lib/usage/usageNotices'

/**
 * Copy for the notice system, the limit sheet, the Usage page and the Sparks packs (monetization plan v9, notices and usage board).
 * Rules: "buddget Pro" in Latin letters; none of free trial / web / website / cheaper / checkout / refund in either language
 * (usageCopy.test.ts); percentages only, credits stay internal; reset times are dates and clock times, never a countdown.
 */
export interface NoticeData {
  /** A clock time or a day and date, already formatted for the person. */
  time: string
  day: string
  date: string
  n: number
  sparks: number
}

interface Entry { title: (d: NoticeData) => string; body?: (d: NoticeData) => string }

export interface UsageCopy {
  notices: Record<NoticeKey, Entry>
  actions: {
    seeUsage: string; later: string; seePro: string; goPro: string; getSparks: string; notNow: string; tryAgain: string; updatePayment: string
    askAdvisor: string; scanReceipt: string; seePlans: string; keepPro: string; manage: string; rejoin: string; howLimitsWork: string; dismiss: string
  }
  sheet: {
    sparksHead: string; sparksTitle: string; sparksFrom: (price: string) => string; sparksLines: [string, string, string]
    proHead: string; proTitle: string; proPrice: (price: string) => string; proPerMonth: (price: string) => string; proLines: [string, string, string]
    plusBonus: string
    howTitle: string; howBody: string
    pausedUntil: (when: string) => string
  }
  meter: { session: string; week: string; pct: (n: number) => string; resets: (when: string) => string; reached: string; updated: (time: string) => string; viewsOf: (used: number, limit: number) => string; viewsLabel: string }
  page: {
    title: string; freePlan: string; proPlan: string; trialPlan: (day: number) => string; needMore: string; sparksHead: string; sparksNote: string
    byFeature: string; features: { chat: string; receipt: string; budget: string; goals: string; other: string }; smsNever: string
    otherLimits: string; plans: string; plansValue: (used: number, limit: number | null) => string; views: string; viewsValue: (used: number, limit: number | null, resets: string) => string
    advisor: string; advisorValue: (left: number) => string; advisorIncluded: string; included: string; unlimited: string
    loading: string; errorTitle: string; errorBody: string; bonusAdded: string
  }
  balance: { title: string; from: (time: string) => string; matches: string; differs: (amount: string) => string; left: (n: number) => string; usedOf: (used: number, limit: number) => string; blocked: string }
  packs: {
    title: string; aboutQuick: (n: number) => string; aboutScans: (n: number, scans: number) => string; weeks: (n: number) => string
    more: string; buy: (sparks: number, price: string) => string; oneTime: (store: string) => string; withPro: (base: number, percent: number) => string; unavailable: string
  }
}

const en: UsageCopy = {
  notices: {
    session80: { title: () => 'You’ve used 80% of this session', body: (d) => `Resets at ${d.time}` },
    week80: { title: () => 'You’ve used 80% of this week', body: (d) => `Resets ${d.day}` },
    session_sparks: { title: (d) => `Session limit reached. Using your Sparks until ${d.time}.` },
    session_block: { title: () => 'Session limit reached', body: (d) => `Buddgy can answer again at ${d.time}. Everything else keeps working; SMS never counts.` },
    session_block_first: { title: () => 'Session limit reached', body: (d) => `Buddgy can answer again at ${d.time}.` },
    week_block: { title: () => 'Weekly limit reached', body: (d) => `Buddgy can answer again on ${d.day}.` },
    both_block: { title: () => 'Weekly limit reached', body: (d) => `Session and week are both used up; the week resets later, on ${d.day}.` },
    pro_week: { title: () => 'Weekly limit reached', body: (d) => `Pro’s weekly limit resets on ${d.day}.` },
    trial_block: { title: () => 'Session limit reached', body: (d) => `Your trial has Pro limits. Buddgy can answer again at ${d.time}.` },
    sparks_low: { title: (d) => `${d.sparks} Sparks left`, body: () => 'You’re past the session limit, so each answer uses Sparks.' },
    sparks_empty: { title: () => 'Your Sparks are used up', body: (d) => `The limit is still reached; Buddgy can answer again at ${d.time}.` },
    buy_ok: { title: (d) => `${d.sparks} Sparks added.` },
    buy_fail: { title: () => 'The store didn’t finish. Nothing was charged.' },
    buy_pending: { title: (d) => `Waiting for the store to confirm ${d.sparks} Sparks`, body: () => 'They’re added as soon as it does. You don’t need to stay here.' },
    restored: { title: () => 'Purchases restored. Your Sparks are on your account.' },
    advisor_free: { title: () => 'This is an Advisor question', body: () => 'You have 1 free Advisor answer this month. Use it here?' },
    advisor_used: { title: () => 'Quick answer. Advisor is in Pro', body: (d) => `Your free Advisor answer resets ${d.date}.` },
    advisor_locked: { title: () => 'The Advisor is in Pro', body: (d) => `Your free Advisor answer this month is used; it resets ${d.date}. Buddgy can still give a quick answer.` },
    plan3: { title: () => 'Free keeps 2 saved plans', body: () => 'Delete one you don’t need, or keep every plan with Pro. Sparks don’t add plans.' },
    plans_ro: { title: (d) => `${d.n} plans are read-only`, body: () => 'Your active plan works as before. Nothing was deleted.' },
    views7: { title: (d) => `${d.n} live balance views left this month` },
    views10: { title: () => '10 of 10 balance views used', body: (d) => `They reset ${d.date}. Balances from your own entries stay free and visible.` },
    reset_granted: { title: () => 'Your weekly limit was reset by buddget support.' },
    reset_back: { title: () => 'Your AI limit is back.' },
    grace: { title: () => 'The store couldn’t take this month’s payment', body: (d) => `You keep Pro until ${d.date} while it tries again.` },
    cancelled: { title: (d) => `Pro ends ${d.date}`, body: () => 'You cancelled in the store. Nothing changes until then, and nothing is deleted after.' },
    expired: { title: () => 'Your Pro ended. Nothing was deleted.', body: (d) => `Free limits apply now.${d.n > 0 ? ` ${d.n} plans are read-only.` : ''}` },
    'trial.d3': { title: () => 'Try the Advisor', body: () => 'Ask how to save 2,000 this month. It’s part of your Pro trial.' },
    'trial.d10': { title: () => 'Scan a receipt', body: () => 'Point the camera at any receipt and Buddgy fills in the expense.' },
    'trial.d23': { title: () => '7 days of Pro left', body: (d) => `On ${d.date} you move to Free; nothing is deleted.` },
    'trial.d28': { title: () => '2 days of Pro left', body: (d) => `On ${d.date} your limits move to Free. Nothing is deleted.` },
    'trial.d37': { title: () => 'Only if you want Pro back', body: () => 'This is the last reminder.' },
  },
  actions: {
    seeUsage: 'See usage', later: 'Later', seePro: 'See Pro', goPro: 'Go Pro', getSparks: 'Get Sparks', notNow: 'Not now', tryAgain: 'Try again', updatePayment: 'Update payment',
    askAdvisor: 'Ask the Advisor', scanReceipt: 'Scan a receipt', seePlans: 'See plans', keepPro: 'Keep Pro', manage: 'Manage', rejoin: 'Rejoin Pro', howLimitsWork: 'How limits work', dismiss: 'Dismiss',
  },
  sheet: {
    sparksHead: 'Sparks', sparksTitle: 'Keep going now', sparksFrom: (price) => `From ${price}`, sparksLines: ['About 230 quick answers', 'Use them right away', 'Never expire'],
    proHead: 'buddget Pro', proTitle: '10x more before a limit', proPrice: (price) => `${price} a year`, proPerMonth: (price) => `About ${price} a month`, proLines: ['10x the AI', 'The Advisor', 'Unlimited plans, +25% Sparks'],
    plusBonus: 'Your +25% is already added',
    howTitle: 'How limits work', howBody: 'AI use is measured by what each request really costs. A session lasts 5 hours from your first request; the week resets on your week-start day. SMS tracking never counts.',
    pausedUntil: (when) => `Replies paused until ${when}`,
  },
  meter: {
    session: 'Current session', week: 'This week', pct: (n) => `${n}%`, resets: (when) => `Resets ${when}`, reached: 'Limit reached', updated: (time) => `Offline · updated ${time}`,
    viewsOf: (used, limit) => `${used} of ${limit}`, viewsLabel: 'Live balance views',
  },
  page: {
    title: 'Usage', freePlan: 'Free plan', proPlan: 'buddget Pro', trialPlan: (day) => `Pro trial · day ${day} of 30`, needMore: 'Need more?', sparksHead: 'Sparks', sparksNote: 'Used only after a limit is reached. Never expire.',
    byFeature: 'This week by feature', features: { chat: 'Buddgy chat and voice', receipt: 'Receipt scans', budget: 'AI budget', goals: 'Goal estimates', other: 'Other' }, smsNever: 'Never counts',
    otherLimits: 'Other limits', plans: 'Budget plans', plansValue: (used, limit) => (limit === null ? 'Unlimited' : `${used} of ${limit}`),
    views: 'Live balance views', viewsValue: (used, limit, resets) => (limit === null ? 'Included' : `${used} of ${limit}, resets ${resets}`),
    advisor: 'Advisor', advisorValue: (left) => (left > 0 ? `${left} free answer this month` : 'Free answer used this month'), advisorIncluded: 'Included', included: 'Included', unlimited: 'Unlimited',
    loading: 'Loading your usage…', errorTitle: 'Couldn’t load your usage', errorBody: 'Check your connection and try again. Your limits haven’t changed.', bonusAdded: 'Your +25% is already added',
  },
  balance: { title: 'Bank-confirmed balance', from: (time) => `From the bank’s SMS at ${time}`, matches: 'Matches your entries', differs: (amount) => `Differs by ${amount}`, left: (n) => `${n} live balance views left this month`, usedOf: (used, limit) => `${used} of ${limit} used this month`, blocked: 'Live balance views are used up for this month. Balances from your own entries stay free and visible.' },
  packs: {
    title: 'Sparks', aboutQuick: (n) => `About ${n} quick answers`, aboutScans: (n, scans) => `About ${n} quick answers or ${scans} receipt scans`, weeks: (n) => `About ${n} extra weeks of Pro-level use`,
    more: 'More packs', buy: (sparks, price) => `Buy ${sparks} Sparks for ${price}`, oneTime: (store) => `One-time purchase through the ${store}.`, withPro: (base, percent) => `+${percent}% with Pro, base ${base}`, unavailable: 'Packs are not available right now. Try again shortly.',
  },
}

const ar: UsageCopy = {
  notices: {
    session80: { title: () => 'استخدمت 80% من هذه الجلسة', body: (d) => `تتجدد الساعة ${d.time}` },
    week80: { title: () => 'استخدمت 80% من هذا الأسبوع', body: (d) => `تتجدد ${d.day}` },
    session_sparks: { title: (d) => `تم بلوغ حد الجلسة. نستخدم Sparks حتى ${d.time}.` },
    session_block: { title: () => 'تم بلوغ حد الجلسة', body: (d) => `يمكن لـ Buddgy الرد مجدداً الساعة ${d.time}. كل شيء آخر يعمل؛ SMS لا يُحتسب.` },
    session_block_first: { title: () => 'تم بلوغ حد الجلسة', body: (d) => `يمكن لـ Buddgy الرد مجدداً الساعة ${d.time}.` },
    week_block: { title: () => 'تم بلوغ الحد الأسبوعي', body: (d) => `يمكن لـ Buddgy الرد مجدداً يوم ${d.day}.` },
    both_block: { title: () => 'تم بلوغ الحد الأسبوعي', body: (d) => `الجلسة والأسبوع كلاهما مستهلك؛ يتجدد الأسبوع لاحقاً، يوم ${d.day}.` },
    pro_week: { title: () => 'تم بلوغ الحد الأسبوعي', body: (d) => `حد Pro الأسبوعي يتجدد يوم ${d.day}.` },
    trial_block: { title: () => 'تم بلوغ حد الجلسة', body: (d) => `تجربتك بحدود Pro. يمكن لـ Buddgy الرد مجدداً الساعة ${d.time}.` },
    sparks_low: { title: (d) => `متبقٍّ ${d.sparks} Sparks`, body: () => 'تجاوزت حد الجلسة، لذا كل إجابة تستخدم Sparks.' },
    sparks_empty: { title: () => 'استُهلكت Sparks', body: (d) => `الحد ما زال مبلوغاً؛ يمكن لـ Buddgy الرد مجدداً الساعة ${d.time}.` },
    buy_ok: { title: (d) => `أُضيفت ${d.sparks} Sparks.` },
    buy_fail: { title: () => 'لم يكمل المتجر العملية. لم يُدفع أي مبلغ.' },
    buy_pending: { title: (d) => `بانتظار تأكيد المتجر لـ ${d.sparks} Sparks`, body: () => 'تُضاف فور التأكيد. لا حاجة لتبقى هنا.' },
    restored: { title: () => 'تمت استعادة المشتريات. Sparks في حسابك.' },
    advisor_free: { title: () => 'هذا سؤال للمستشار', body: () => 'لديك إجابة مجانية واحدة من المستشار هذا الشهر. هل تستخدمها هنا؟' },
    advisor_used: { title: () => 'إجابة سريعة. المستشار في Pro', body: (d) => `إجابتك المجانية من المستشار تتجدد ${d.date}.` },
    advisor_locked: { title: () => 'المستشار في Pro', body: (d) => `استُخدمت إجابتك المجانية من المستشار هذا الشهر؛ تتجدد ${d.date}. ما زال بإمكان Buddgy تقديم إجابة سريعة.` },
    plan3: { title: () => 'المجاني يحتفظ بخطتين محفوظتين', body: () => 'احذف خطة لا تحتاجها، أو احتفظ بكل الخطط مع Pro. Sparks لا تضيف خططاً.' },
    plans_ro: { title: (d) => `${d.n} خطط للقراءة فقط`, body: () => 'خطتك النشطة تعمل كما كانت. لم يُحذف شيء.' },
    views7: { title: (d) => `متبقٍّ ${d.n} عروض للرصيد المباشر هذا الشهر` },
    views10: { title: () => 'استُخدمت 10 من 10 عروض للرصيد', body: (d) => `تتجدد ${d.date}. الأرصدة من إدخالاتك تبقى مجانية ومرئية.` },
    reset_granted: { title: () => 'أعاد دعم buddget تعيين حدك الأسبوعي.' },
    reset_back: { title: () => 'عاد حد الذكاء الاصطناعي.' },
    grace: { title: () => 'لم يتمكن المتجر من تحصيل دفعة هذا الشهر', body: (d) => `تحتفظ بـ Pro حتى ${d.date} بينما يعيد المحاولة.` },
    cancelled: { title: (d) => `ينتهي Pro في ${d.date}`, body: () => 'ألغيت من المتجر. لا شيء يتغير حتى ذلك الحين، ولن يُحذف شيء بعده.' },
    expired: { title: () => 'انتهى Pro. لم يُحذف شيء.', body: (d) => `تُطبَّق حدود المجاني الآن.${d.n > 0 ? ` ${d.n} خطط للقراءة فقط.` : ''}` },
    'trial.d3': { title: () => 'جرّب المستشار', body: () => 'اسأل كيف توفر 2,000 هذا الشهر. هذا جزء من تجربة Pro.' },
    'trial.d10': { title: () => 'امسح إيصالاً', body: () => 'وجّه الكاميرا إلى أي إيصال ويملأ Buddgy المصروف.' },
    'trial.d23': { title: () => 'تبقّى 7 أيام من Pro', body: (d) => `في ${d.date} تنتقل إلى المجاني؛ لن يُحذف شيء.` },
    'trial.d28': { title: () => 'تبقّى يومان من Pro', body: (d) => `في ${d.date} تنتقل حدودك إلى المجاني. لن يُحذف شيء.` },
    'trial.d37': { title: () => 'فقط إن أردت عودة Pro', body: () => 'هذا آخر تذكير.' },
  },
  actions: {
    seeUsage: 'عرض الاستخدام', later: 'لاحقاً', seePro: 'اعرف Pro', goPro: 'انتقل إلى Pro', getSparks: 'احصل على Sparks', notNow: 'ليس الآن', tryAgain: 'حاول مجدداً', updatePayment: 'تحديث الدفع',
    askAdvisor: 'اسأل المستشار', scanReceipt: 'امسح إيصالاً', seePlans: 'عرض الخطط', keepPro: 'احتفظ بـ Pro', manage: 'إدارة', rejoin: 'انضم إلى Pro من جديد', howLimitsWork: 'كيف تعمل الحدود', dismiss: 'إغلاق',
  },
  sheet: {
    sparksHead: 'Sparks', sparksTitle: 'تابع الآن', sparksFrom: (price) => `من ${price}`, sparksLines: ['حوالي 230 إجابة سريعة', 'استخدمها فوراً', 'لا تنتهي صلاحيتها'],
    proHead: 'buddget Pro', proTitle: '10 أضعاف قبل أي حد', proPrice: (price) => `${price} سنوياً`, proPerMonth: (price) => `حوالي ${price} شهرياً`, proLines: ['10 أضعاف الذكاء الاصطناعي', 'المستشار', 'خطط بلا حد، و25% Sparks إضافية'],
    plusBonus: 'الـ 25% الإضافية مضافة بالفعل',
    howTitle: 'كيف تعمل الحدود', howBody: 'يُقاس استخدام الذكاء الاصطناعي بالتكلفة الفعلية لكل طلب. تستمر الجلسة 5 ساعات من أول طلب؛ ويتجدد الأسبوع في يوم بداية أسبوعك. تتبع SMS لا يُحتسب أبداً.',
    pausedUntil: (when) => `الردود متوقفة حتى ${when}`,
  },
  meter: {
    session: 'الجلسة الحالية', week: 'هذا الأسبوع', pct: (n) => `${n}%`, resets: (when) => `تتجدد ${when}`, reached: 'تم بلوغ الحد', updated: (time) => `دون اتصال · آخر تحديث ${time}`,
    viewsOf: (used, limit) => `${used} من ${limit}`, viewsLabel: 'عروض الرصيد المباشر',
  },
  page: {
    title: 'الاستخدام', freePlan: 'الخطة المجانية', proPlan: 'buddget Pro', trialPlan: (day) => `تجربة Pro · اليوم ${day} من 30`, needMore: 'تحتاج المزيد؟', sparksHead: 'Sparks', sparksNote: 'تُستخدم فقط بعد بلوغ الحد. لا تنتهي صلاحيتها.',
    byFeature: 'هذا الأسبوع حسب الميزة', features: { chat: 'محادثة Buddgy والصوت', receipt: 'مسح الإيصالات', budget: 'الميزانية بالذكاء الاصطناعي', goals: 'تقديرات الأهداف', other: 'أخرى' }, smsNever: 'لا يُحتسب',
    otherLimits: 'حدود أخرى', plans: 'خطط الميزانية', plansValue: (used, limit) => (limit === null ? 'بلا حد' : `${used} من ${limit}`),
    views: 'عروض الرصيد المباشر', viewsValue: (used, limit, resets) => (limit === null ? 'مضمّن' : `${used} من ${limit}، تتجدد ${resets}`),
    advisor: 'المستشار', advisorValue: (left) => (left > 0 ? 'إجابة مجانية واحدة هذا الشهر' : 'استُخدمت الإجابة المجانية هذا الشهر'), advisorIncluded: 'مضمّن', included: 'مضمّن', unlimited: 'بلا حد',
    loading: 'جارٍ تحميل استخدامك…', errorTitle: 'تعذّر تحميل استخدامك', errorBody: 'تحقق من الاتصال وحاول مجدداً. حدودك لم تتغير.', bonusAdded: 'الـ 25% الإضافية مضافة بالفعل',
  },
  balance: { title: 'الرصيد المؤكد من البنك', from: (time) => `من رسالة البنك الساعة ${time}`, matches: 'يطابق إدخالاتك', differs: (amount) => `يختلف بمقدار ${amount}`, left: (n) => `متبقٍّ ${n} عروض للرصيد المباشر هذا الشهر`, usedOf: (used, limit) => `استُخدمت ${used} من ${limit} هذا الشهر`, blocked: 'انتهت عروض الرصيد المباشر لهذا الشهر. الأرصدة من إدخالاتك تبقى مجانية ومرئية.' },
  packs: {
    title: 'Sparks', aboutQuick: (n) => `حوالي ${n} إجابة سريعة`, aboutScans: (n, scans) => `حوالي ${n} إجابة سريعة أو ${scans} مسح إيصال`, weeks: (n) => `حوالي ${n} أسابيع إضافية باستخدام بمستوى Pro`,
    more: 'باقات أخرى', buy: (sparks, price) => `اشترِ ${sparks} Sparks بسعر ${price}`, oneTime: (store) => `عملية شراء لمرة واحدة عبر ${store}.`, withPro: (base, percent) => `+${percent}% مع Pro، الأساس ${base}`, unavailable: 'الباقات غير متاحة الآن. حاول بعد قليل.',
  },
}

export const usageCopy: Record<Locale, UsageCopy> = { en, ar }

export function useUsageCopy(): UsageCopy {
  const { locale } = useLocale()
  return usageCopy[locale]
}
