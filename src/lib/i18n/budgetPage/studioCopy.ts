import type { StudioStage } from '@/lib/budget/infoGaps'

export interface StudioQuestionCopy {
  label: string
  why: string
  opts?: Record<string, string>
}

/** Copy for the AI studio, the building screen and review. Placeholders: {n} is filled by the caller. */
export interface BudgetStudioCopy {
  title: string
  buddgyAsks: string
  close: string
  stages: Record<StudioStage, string>
  progress: (pct: number) => string
  why: string
  cont: string
  yes: string
  no: string
  confirm: string
  estimate: string
  saved: string
  slider: { low: string; high: string }
  stepper: { less: string; more: string; unit: (n: number) => string }
  building: { title: string; steps: [string, string, string]; offline: string }
  q: Record<string, StudioQuestionCopy>
  review: {
    title: string
    why: string
    risks: string
    estimated: (n: number) => string
    adjust: string
    edit: string
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
  stages: { found: 'What I found', home: 'Home', life: 'Daily life', debts: 'Debts', secure: 'Security', priorities: 'Priorities' },
  progress: (pct) => `${pct}% known`,
  why: 'Why I ask',
  cont: 'Continue',
  yes: 'Yes',
  no: 'No',
  confirm: 'Looks right',
  estimate: 'Estimate for me',
  saved: 'Saved to your profile',
  slider: { low: 'Save hard', high: 'Live comfortably' },
  stepper: { less: 'Less', more: 'More', unit: (n) => String(n) },
  building: {
    title: 'Building your plan',
    steps: ['Sizing your bills and debts', 'Matching your spending habits', 'Writing the reasons'],
    offline: 'Built from your numbers. Buddgy could not add notes this time.',
  },
  q: {
    confirmIncome: { label: 'Your income is about {n} a month. Right?', why: 'Every line is sized against this number.' },
    income: { label: 'What do you take home each month?', why: 'A plan needs an income to divide.' },
    confirmBills: { label: 'I found {n} bills and subscriptions. Anything missing comes next.', why: 'These become fixed lines you do not have to retype.' },
    confirmDebts: { label: 'I found {n} debts. I will pay at least the minimums.', why: 'Minimums are fixed costs; extra payoff comes after.' },
    debtApr: { label: 'What interest rate (APR %) does this debt charge?', why: 'High rates should be paid before investing.' },
    confirmGoals: { label: 'I found {n} goals and will fund them as set.', why: 'Goals keep their own funding settings.' },
    housing: { label: 'How do you live?', why: 'Housing is usually the biggest line.', opts: { rent: 'I rent', own: 'I own', family: 'With family', company: 'Company housing' } },
    rent: { label: 'What is your monthly rent or mortgage?', why: 'Fixed, due every month.' },
    rentIncludesUtilities: { label: 'Does it include utilities?', why: 'Avoids planning electricity and water twice.' },
    household: { label: 'Who is in your household?', why: 'Groceries and safety needs scale with people.', opts: { solo: 'Just me', couple: 'Two of us', family: 'Family' } },
    dependents: { label: 'How many dependents?', why: 'Children add school and care costs.' },
    supportsOthers: { label: 'Do you support family elsewhere?', why: 'Regular transfers are a real fixed cost.' },
    incomeStability: { label: 'How steady is your income?', why: 'Uneven income needs a bigger cushion.', opts: { fixed: 'Fixed', variable: 'Varies', mixed: 'A bit of both' } },
    missingBills: { label: 'Any of these I missed?', why: 'Small bills add up.', opts: { phone: 'Phone', internet: 'Internet', insurance: 'Insurance', school: 'School', help: 'Home help', gym: 'Gym' } },
    foodFrequency: { label: 'How often do you eat out or order in?', why: 'Sizes your dining line.', opts: { everyday: 'Every day', mostdays: 'Most days', sometimes: 'Sometimes', rarely: 'Rarely' } },
    lifestyle: { label: 'How would you describe your lifestyle?', why: 'Sets how much room everyday spending gets.', opts: { minimal: 'Minimal', balanced: 'Balanced', comfortable: 'Comfortable' } },
    transportMode: { label: 'How do you get around?', why: 'Transport differs a lot by mode.', opts: { public: 'Public', car: 'My car', taxi: 'Taxis', walk: 'On foot' } },
    carCosts: { label: 'Which car costs do you pay?', why: 'Fuel and insurance are separate lines.', opts: { fuel: 'Fuel', insurance: 'Insurance' } },
    payoffStrategy: { label: 'How should spare money pay down debt?', why: 'Highest rate first saves the most.', opts: { avalanche: 'Highest rate first', snowball: 'Smallest first', minimums: 'Minimums only' } },
    extraPayoff: { label: 'Extra to pay toward debt each month?', why: 'On top of the minimums.' },
    emergencyMonths: { label: 'How many months of expenses should your safety net cover?', why: 'Three is common; six if income varies or you support others.' },
    investInterest: { label: 'Do you want to invest as well?', why: 'Adds a Grow line after the safety net.' },
    zakat: { label: 'Do you want to set aside zakat?', why: 'Adds a monthly set-aside you can adjust.' },
    priorities: { label: 'Pick up to three priorities', why: 'These decide where spare money goes first.', opts: { safety: 'Safety net', debt: 'Clear debt', goals: 'Goals', invest: 'Invest', enjoy: 'Enjoy life', family: 'Family' } },
    securityLean: { label: 'Save hard or live comfortably?', why: 'Moves money between saving and everyday spending.' },
  },
  review: {
    title: 'Your plan',
    why: 'Why this plan',
    risks: 'Worth watching',
    estimated: (n) => `${n} ${n === 1 ? 'line is' : 'lines are'} estimated`,
    adjust: 'Ask Buddgy to change',
    edit: 'Edit by hand',
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
    nothing: 'I could not turn that into a change. Try naming a line and an amount.',
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
  stages: { found: 'ما وجدته', home: 'السكن', life: 'الحياة اليومية', debts: 'الديون', secure: 'الأمان', priorities: 'الأولويات' },
  progress: (pct) => `${pct}% معروف`,
  why: 'لماذا أسأل',
  cont: 'متابعة',
  yes: 'نعم',
  no: 'لا',
  confirm: 'صحيح',
  estimate: 'قدّر لي',
  saved: 'تم الحفظ في ملفك',
  slider: { low: 'ادخار قوي', high: 'عيش مريح' },
  stepper: { less: 'أقل', more: 'أكثر', unit: (n) => String(n) },
  building: {
    title: 'نبني خطتك',
    steps: ['حساب الفواتير والديون', 'مطابقة عادات إنفاقك', 'كتابة الأسباب'],
    offline: 'بُنيت من أرقامك. لم يستطع بادي إضافة ملاحظات هذه المرة.',
  },
  q: {
    confirmIncome: { label: 'دخلك حوالي {n} شهريًا. صحيح؟', why: 'كل بند يُحسب على هذا الرقم.' },
    income: { label: 'كم تستلم شهريًا؟', why: 'الخطة تحتاج دخلًا لتقسيمه.' },
    confirmBills: { label: 'وجدت {n} فواتير واشتراكات. أي شيء ناقص سأسألك عنه لاحقًا.', why: 'تصبح بنودًا ثابتة دون إعادة كتابتها.' },
    confirmDebts: { label: 'وجدت {n} ديون. سأسدد الحد الأدنى على الأقل.', why: 'الحد الأدنى تكلفة ثابتة، والسداد الإضافي يأتي بعدها.' },
    debtApr: { label: 'ما نسبة الفائدة السنوية (٪) على هذا الدين؟', why: 'الفوائد المرتفعة تُسدد قبل الاستثمار.' },
    confirmGoals: { label: 'وجدت {n} أهداف وسأموّلها كما ضبطتها.', why: 'الأهداف تحتفظ بإعدادات تمويلها.' },
    housing: { label: 'كيف تسكن؟', why: 'السكن عادةً أكبر بند.', opts: { rent: 'أستأجر', own: 'أملك', family: 'مع العائلة', company: 'سكن الشركة' } },
    rent: { label: 'كم الإيجار أو القسط الشهري؟', why: 'بند ثابت كل شهر.' },
    rentIncludesUtilities: { label: 'هل يشمل المرافق؟', why: 'لتجنب حساب الكهرباء والماء مرتين.' },
    household: { label: 'من في أسرتك؟', why: 'البقالة والأمان تتناسب مع عدد الأفراد.', opts: { solo: 'أنا فقط', couple: 'اثنان', family: 'عائلة' } },
    dependents: { label: 'كم عدد المعالين؟', why: 'الأطفال يضيفون تكاليف الدراسة والرعاية.' },
    supportsOthers: { label: 'هل تدعم أسرة في مكان آخر؟', why: 'التحويلات المنتظمة تكلفة ثابتة فعلية.' },
    incomeStability: { label: 'ما مدى ثبات دخلك؟', why: 'الدخل المتذبذب يحتاج احتياطيًا أكبر.', opts: { fixed: 'ثابت', variable: 'متغير', mixed: 'مزيج' } },
    missingBills: { label: 'هل فاتني شيء من هذه؟', why: 'الفواتير الصغيرة تتراكم.', opts: { phone: 'الهاتف', internet: 'الإنترنت', insurance: 'التأمين', school: 'المدرسة', help: 'مساعدة منزلية', gym: 'النادي' } },
    foodFrequency: { label: 'كم مرة تأكل خارج المنزل أو تطلب؟', why: 'يحدد بند المطاعم.', opts: { everyday: 'كل يوم', mostdays: 'معظم الأيام', sometimes: 'أحيانًا', rarely: 'نادرًا' } },
    lifestyle: { label: 'كيف تصف نمط حياتك؟', why: 'يحدد مساحة الإنفاق اليومي.', opts: { minimal: 'بسيط', balanced: 'متوازن', comfortable: 'مريح' } },
    transportMode: { label: 'كيف تتنقل؟', why: 'تكلفة التنقل تختلف كثيرًا حسب الوسيلة.', opts: { public: 'مواصلات عامة', car: 'سيارتي', taxi: 'سيارات أجرة', walk: 'سيرًا' } },
    carCosts: { label: 'أي تكاليف للسيارة تدفعها؟', why: 'الوقود والتأمين بندان منفصلان.', opts: { fuel: 'الوقود', insurance: 'التأمين' } },
    payoffStrategy: { label: 'كيف يسدد الفائض الدين؟', why: 'الأعلى فائدة أولًا يوفر أكثر.', opts: { avalanche: 'الأعلى فائدة أولًا', snowball: 'الأصغر أولًا', minimums: 'الحد الأدنى فقط' } },
    extraPayoff: { label: 'كم تضيف شهريًا لسداد الدين؟', why: 'فوق الحد الأدنى.' },
    emergencyMonths: { label: 'كم شهرًا من المصاريف تغطي شبكة أمانك؟', why: 'ثلاثة أشهر شائعة، وستة إذا كان دخلك متغيرًا أو تعول غيرك.' },
    investInterest: { label: 'هل تريد الاستثمار أيضًا؟', why: 'يضيف بند نمو بعد شبكة الأمان.' },
    zakat: { label: 'هل تريد ادخار الزكاة؟', why: 'يضيف مبلغًا شهريًا يمكنك تعديله.' },
    priorities: { label: 'اختر حتى ثلاث أولويات', why: 'تحدد أين يذهب الفائض أولًا.', opts: { safety: 'شبكة الأمان', debt: 'سداد الدين', goals: 'الأهداف', invest: 'الاستثمار', enjoy: 'الاستمتاع', family: 'العائلة' } },
    securityLean: { label: 'ادخار قوي أم عيش مريح؟', why: 'ينقل المال بين الادخار والإنفاق اليومي.' },
  },
  review: {
    title: 'خطتك',
    why: 'لماذا هذه الخطة',
    risks: 'يستحق المتابعة',
    estimated: (n) => `${n} بنود مقدّرة`,
    adjust: 'اطلب من بادي التعديل',
    edit: 'عدّل يدويًا',
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
