import type { FlowStage } from '@/lib/budget/flow/flow'
import { flowCopyAr, flowCopyEn, type FlowQuestionCopy } from './flowCopy'

export type StudioQuestionCopy = FlowQuestionCopy

/** Copy for the AI studio, the building screen and review. Placeholders: {n} is filled by the caller. */
export interface BudgetStudioCopy {
  title: string
  buddgyAsks: string
  close: string
  known: { open: string; title: string; sub: string; empty: string; change: string; yes: string; no: string; income: string }
  stages: Record<FlowStage, string>
  progress: (pct: number) => string
  why: string
  cont: string
  yes: string
  no: string
  confirm: string
  /** The "What I found" screen: tracked income, bills, debts and goals, each confirmed or corrected. */
  found: { title: string; sub: string; right: string; change: string }
  /** The "Not sure" chip under an answer: the plan uses a typical value and marks the line as estimated. */
  estimate: string
  buildNow: (percent: number) => string
  /** First step, always asked: describe your situation in your own words. */
  opener: {
    kicker: string
    working: string
    title: string
    hint: string
    placeholder: string
    examples: string[]
    cta: string
    understood: (n: number) => string
    change: string
    cont: string
  }
  /** Names given to the records the studio creates from the answers. */
  entities: { income: string; savings: string; debts: Record<string, string>; goals: Record<string, string> }
  saved: string
  slider: { low: string; high: string }
  stepper: { less: string; more: string; unit: (n: number) => string }
  building: { title: string; steps: [string, string, string]; offline: string; error: string; retry: string }
  back: string
  q: Record<string, StudioQuestionCopy>
  review: {
    title: string
    why: string
    risks: string
    estimated: (n: number) => string
    adjust: string
    start: string
    activate: string
    aiNote: string
    close: string
  }
  adjust: {
    title: string
    placeholder: string
    examples: string[]
    send: string
    thinking: string
    changes: (n: number) => string
    balanced: string
    left: (amount: string) => string
    over: (amount: string) => string
    apply: string
    cancel: string
    nothing: string
    failed: string
    quota: string
    unavailable: string
    applied: string
    undo: string
    rejected: (n: number) => string
    remember: string
    rememberHint: string
    remembered: string
  }
}

const en: BudgetStudioCopy = {
  title: 'Build with Buddgy',
  buddgyAsks: 'Buddgy asks',
  close: 'Close',
  known: { open: 'What I know', title: 'What Buddgy knows', sub: 'Tap anything to change it. Your answers are already saved to your profile.', empty: 'Nothing yet.', change: 'Change', yes: 'Yes', no: 'No', income: 'Monthly income' },
  stages: { you: 'About you', home: 'Home', life: 'Daily life', debts: 'Debts', secure: 'Security', priorities: 'Priorities' },
  progress: (pct) => `${pct}% known`,
  why: 'Why I ask',
  cont: 'Continue',
  yes: 'Yes',
  no: 'No',
  confirm: 'Looks right',
  found: { title: 'Here is what I found', sub: 'From your own records. Mark anything that is off and I will ask about it.', right: 'Right', change: 'Not right' },
  estimate: 'Not sure, let Buddgy estimate',
  buildNow: (percent) => `Good enough, build now (${percent}%)`,
  opener: {
    kicker: 'Buddgy listens',
    working: 'Reading what you wrote',
    title: 'Tell me about yourself',
    hint: 'Add your take-home pay and payday, rent or mortgage, family, debts and what you owe, savings, and anything you want to reach. The more you write, the fewer questions you answer.',
    placeholder: 'e.g. I earn 18,000 a month on the 25th, rent a flat for 6,000, have two kids, owe 40,000 on a car loan and want to save for a home',
    examples: ['I work for a company, rent a flat, no debts', 'Freelancer, income changes a lot, I live with family', 'I own my home, owe a card, want to save'],
    cta: 'Continue',
    understood: (n) => (n === 1 ? 'I picked up 1 thing' : `I picked up ${n} things`),
    change: 'I will ask about the rest. Tap the list icon any time to change an answer.',
    cont: 'Looks right, continue',
  },
  entities: {
    income: 'Salary',
    savings: 'Savings',
    debts: { 'answered-card': 'Card', 'answered-loan': 'Loan', 'answered-bnpl': 'Instalments', 'answered-family': 'Family and friends', 'answered-student': 'Student loan', 'answered-tax': 'Back taxes', 'answered-car': 'Car loan' },
    goals: { vacation: 'Trip', house: 'Home', car: 'Car', education: 'Education', wedding: 'Wedding', business: 'Business', custom: 'My goal' },
  },
  saved: 'Saved to your profile',
  slider: { low: 'Save hard', high: 'Live comfortably' },
  stepper: { less: 'Less', more: 'More', unit: (n) => String(n) },
  building: {
    title: 'Building your plan',
    steps: ['Sizing your bills and debts', 'Matching your spending habits', 'Writing the reasons'],
    offline: 'Built from your numbers. Buddgy could not add notes this time.',
    error: 'Something went wrong while building your plan. Your answers are saved.',
    retry: 'Try again',
  },
  back: 'Previous question',
  q: flowCopyEn,
  review: {
    title: 'Your plan',
    why: 'Why this plan',
    risks: 'Worth watching',
    estimated: (n) => `${n} ${n === 1 ? 'line is' : 'lines are'} estimated`,
    adjust: 'Ask Buddgy',
    start: 'Go through it',
    activate: 'Confirm & activate',
    aiNote: 'Built from your numbers without Buddgy notes.',
    close: 'Close review',
  },
  adjust: {
    title: 'Tell Buddgy what to change',
    placeholder: 'e.g. I do not have a car, cut transport and add 500 to savings',
    examples: ['Spend less on dining', 'Add 500 to savings', 'I do not have a car'],
    send: 'Preview changes',
    thinking: 'Reading your request',
    changes: (n) => `${n} ${n === 1 ? 'change' : 'changes'}`,
    balanced: 'Still balanced',
    left: (amount) => `${amount} left to assign`,
    over: (amount) => `${amount} over income`,
    apply: 'Apply',
    cancel: 'Cancel',
    nothing: 'I couldn\u2019t turn that into a change. Try naming a line and an amount.',
    failed: 'Buddgy could not read that. Try again, or edit by hand.',
    quota: 'You have reached today’s limit for Buddgy changes.',
    unavailable: 'Buddgy is unavailable right now. You can still edit by hand.',
    applied: 'Plan updated',
    undo: 'Undo',
    rejected: (n) => `${n} ${n === 1 ? 'change was' : 'changes were'} skipped (locked, linked or invalid)`,
    remember: 'Remember for next time',
    rememberHint: 'Saved to your account. You can forget it anytime in Buddgy settings.',
    remembered: 'Plan updated. Buddgy will remember that.',
  },
}

const ar: BudgetStudioCopy = {
  ...en,
  title: 'ابنِ مع بادي',
  buddgyAsks: 'بادي يسأل',
  close: 'إغلاق',
  known: { open: 'ما أعرفه', title: 'ما يعرفه بادي', sub: 'اضغط على أي شيء لتغييره. إجاباتك محفوظة في ملفك.', empty: 'لا شيء بعد.', change: 'تغيير', yes: 'نعم', no: 'لا', income: 'الدخل الشهري' },
  stages: { you: 'عنك', home: 'السكن', life: 'الحياة اليومية', debts: 'الديون', secure: 'الأمان', priorities: 'الأولويات' },
  progress: (pct) => `${pct}% معروف`,
  why: 'لماذا أسأل',
  cont: 'متابعة',
  yes: 'نعم',
  no: 'لا',
  confirm: 'صحيح',
  found: { title: 'هذا ما وجدته', sub: 'من سجلاتك. حدّد أي شيء غير صحيح وسأسألك عنه.', right: 'صحيح', change: 'غير صحيح' },
  estimate: 'لست متأكدًا، دع بادي يقدّر',
  buildNow: (percent) => `يكفي، ابنِ الآن (${percent}٪)`,
  opener: {
    kicker: 'Buddgy يستمع',
    working: 'أقرأ ما كتبته',
    title: 'احكِ لي عن نفسك',
    hint: 'اكتب صافي راتبك وموعد استلامه، الإيجار أو القسط العقاري، العائلة، الديون وما تدين به، المدخرات، وما تريد الوصول إليه. كلما كتبت أكثر قلّت الأسئلة.',
    placeholder: 'مثال: أتقاضى 18,000 شهريًا يوم 25، أستأجر شقة بـ 6,000، لدي طفلان، أدين بـ 40,000 قرض سيارة وأريد الادخار لمنزل',
    examples: ['أعمل في شركة، أستأجر شقة، بلا ديون', 'عمل حر، دخلي يتغير كثيرًا، أعيش مع العائلة', 'أملك منزلي، عليّ بطاقة، وأريد الادخار'],
    cta: 'متابعة',
    understood: (n) => (n === 1 ? 'التقطتُ معلومة واحدة' : `التقطتُ ${n} معلومات`),
    change: 'سأسألك عن الباقي. اضغط على أيقونة القائمة في أي وقت لتغيير إجابة.',
    cont: 'صحيح، تابع',
  },
  entities: {
    income: 'الراتب',
    savings: 'المدخرات',
    debts: { 'answered-card': 'البطاقة', 'answered-loan': 'القرض', 'answered-bnpl': 'الأقساط', 'answered-family': 'العائلة والأصدقاء', 'answered-student': 'قرض الدراسة', 'answered-tax': 'ضرائب متأخرة', 'answered-car': 'قرض السيارة' },
    goals: { vacation: 'رحلة', house: 'منزل', car: 'سيارة', education: 'تعليم', wedding: 'زواج', business: 'مشروع', custom: 'هدفي' },
  },
  saved: 'تم الحفظ في ملفك',
  slider: { low: 'ادخار قوي', high: 'عيش مريح' },
  stepper: { less: 'أقل', more: 'أكثر', unit: (n) => String(n) },
  building: {
    title: 'نبني خطتك',
    steps: ['حساب الفواتير والديون', 'مطابقة عادات إنفاقك', 'كتابة الأسباب'],
    offline: 'بُنيت من أرقامك. لم يستطع بادي إضافة ملاحظات هذه المرة.',
    error: 'حدث خطأ أثناء بناء خطتك. إجاباتك محفوظة.',
    retry: 'حاول مجددًا',
  },
  back: 'السؤال السابق',
  q: flowCopyAr,
  review: {
    title: 'خطتك',
    why: 'لماذا هذه الخطة',
    risks: 'يستحق المتابعة',
    estimated: (n) => `${n} بنود مقدّرة`,
    adjust: 'اسأل بادي',
    start: 'راجعها',
    activate: 'تأكيد وتفعيل',
    aiNote: 'بُنيت من أرقامك دون ملاحظات بادي.',
    close: 'إغلاق المراجعة',
  },
  adjust: {
    ...en.adjust,
    title: 'قل لبادي ماذا يغيّر',
    placeholder: 'مثال: ليس لدي سيارة، قلل المواصلات وأضف 500 للادخار',
    examples: ['قلل المطاعم', 'أضف 500 للادخار', 'ليس لدي سيارة'],
    send: 'معاينة التغييرات',
    thinking: 'نقرأ طلبك',
    changes: (n) => `${n} تغييرات`,
    balanced: 'ما زالت متوازنة',
    left: (amount) => `${amount} متبقٍ للتوزيع`,
    over: (amount) => `${amount} فوق الدخل`,
    apply: 'تطبيق',
    cancel: 'إلغاء',
    nothing: 'لم أستطع تحويل ذلك إلى تغيير. اذكر بندًا ومبلغًا.',
    failed: 'لم يستطع بادي قراءة طلبك. حاول مجددًا أو عدّل يدويًا.',
    quota: 'وصلت إلى حد اليوم لتغييرات بادي.',
    unavailable: 'بادي غير متاح الآن. يمكنك التعديل يدويًا.',
    rejected: (n) => `تم تخطي ${n} تغييرات (مقفلة أو مرتبطة أو غير صالحة)`,
    applied: 'تم تحديث الخطة',
    undo: 'تراجع',
    remember: 'تذكّر للمرة القادمة',
    rememberHint: 'يُحفظ في حسابك ويمكنك حذفه في إعدادات بادي.',
    remembered: 'تم تحديث الخطة. سيتذكر بادي ذلك.',
  },
}

export const budgetStudioCopyEn = en
export const budgetStudioCopyAr = ar
