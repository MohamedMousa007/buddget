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
  known: { open: string; title: string; sub: string; empty: string; change: string; yes: string; no: string }
  stages: Record<StudioStage, string>
  progress: (pct: number) => string
  why: string
  cont: string
  yes: string
  no: string
  confirm: string
  estimate: string
  buildNow: string
  /** Optional first step: describe your situation in your own words. */
  opener: {
    kicker: string
    working: string
    title: string
    hint: string
    placeholder: string
    examples: string[]
    cta: string
    skip: string
    understood: (n: number) => string
    change: string
    cont: string
  }
  /** Names given to the records the studio creates from the answers. */
  entities: { income: string; debt: string; savings: string; goals: Record<string, string> }
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
  known: { open: 'What I know', title: 'What Buddgy knows', sub: 'Tap anything to change it. Your answers are already saved to your profile.', empty: 'Nothing yet.', change: 'Change', yes: 'Yes', no: 'No' },
  stages: { found: 'What I found', home: 'Home', life: 'Daily life', debts: 'Debts', secure: 'Security', priorities: 'Priorities' },
  progress: (pct) => `${pct}% known`,
  why: 'Why I ask',
  cont: 'Continue',
  yes: 'Yes',
  no: 'No',
  confirm: 'Looks right',
  estimate: 'Estimate for me',
  buildNow: 'Build my plan now',
  opener: {
    kicker: 'Buddgy listens',
    working: 'Reading what you wrote',
    title: 'Tell me about your situation',
    hint: 'A sentence or two is enough: pay, rent, family, debts, savings. I will skip whatever you already tell me.',
    placeholder: 'e.g. I earn 18,000 a month, rent a flat for 6,000, have two kids and pay 800 a month on a loan',
    examples: ['I work for a company, rent a flat, no debts', 'Freelancer, income changes a lot, I live with family'],
    cta: 'Continue',
    skip: 'Skip, ask me instead',
    understood: (n) => (n === 1 ? 'I picked up 1 thing' : `I picked up ${n} things`),
    change: 'I will ask about the rest. Tap the list icon any time to change an answer.',
    cont: 'Looks right, continue',
  },
  entities: { income: 'Salary', debt: 'My debts', savings: 'Savings', goals: { vacation: 'Trip', house: 'Home', car: 'Car', education: 'Education', wedding: 'Wedding', custom: 'My goal' } },
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
  q: {
    confirmIncome: { label: 'Your income is about {n} a month. Right?', why: 'Every line is sized against this number.' },
    income: { label: 'What do you take home each month?', why: 'Skip it if you have none and I will plan around your expected spending.' },
    confirmBills: { label: 'I found {n} bills and subscriptions. Anything missing comes next.', why: 'These become fixed lines you do not have to retype.' },
    confirmDebts: { label: 'I found {n} debts. I will pay at least the minimums.', why: 'Minimums are fixed costs; extra payoff comes after.' },
    confirmGoals: { label: 'I found {n} goals and will fund them as set.', why: 'Goals keep their own funding settings.' },
    housing: { label: 'How do you live?', why: 'Housing is usually the biggest line.', opts: { rent: 'I rent', own: 'I own', family: 'With family', company: 'Company housing' } },
    rent: { label: 'What is your monthly rent or mortgage?', why: 'Fixed, due every month.' },
    rentIncludesUtilities: { label: 'Does it include utilities?', why: 'Avoids planning electricity and water twice.' },
    household: { label: 'Who is in your household?', why: 'Groceries and safety needs scale with people.', opts: { solo: 'Just me', couple: 'Two of us', family: 'Family' } },
    dependents: { label: 'How many dependents?', why: 'Children add school and care costs.' },
    supportsOthers: { label: 'Do you support family elsewhere?', why: 'Regular transfers are a real fixed cost.' },
    incomeStability: { label: 'How steady is your income?', why: 'Uneven income needs a bigger cushion.', opts: { fixed: 'Fixed', variable: 'Varies', mixed: 'A bit of both' } },
    foodFrequency: { label: 'How often do you eat out or order in?', why: 'Sizes your dining line.', opts: { everyday: 'Every day', mostdays: 'Most days', sometimes: 'Sometimes', rarely: 'Rarely' } },
    lifestyle: { label: 'How would you describe your lifestyle?', why: 'Sets how much room everyday spending gets.', opts: { minimal: 'Minimal', balanced: 'Balanced', comfortable: 'Comfortable' } },
    transportMode: { label: 'How do you get around?', why: 'Transport differs a lot by mode.', opts: { public: 'Public', car: 'My car', taxi: 'Taxis', walk: 'On foot' } },
    emergencyMonths: { label: 'How many months of expenses should your safety net cover?', why: 'Three is common; six if income varies or you support others.' },
    investInterest: { label: 'Do you want to invest as well?', why: 'Adds a Grow line after the safety net.' },
    priorities: { label: 'Pick up to three priorities', why: 'These decide where spare money goes first.', opts: { safety: 'Safety net', debt: 'Clear debt', goals: 'Goals', invest: 'Invest', enjoy: 'Enjoy life', family: 'Family' } },
    rentCheck: { label: 'Your records show about {n} a month for rent. Which is closer?', why: 'Your own records are usually right.', opts: { stated: 'What I entered', records: 'What my records show' } },
    lowMonth: { label: 'In a slow month, about how much do you take home?', why: 'The plan is sized on a bad month, so a good one is a bonus.' },
    cashHeavy: { label: 'Do you pay mostly in cash?', why: 'Cash spending is easy to miss, so I will lean on typical figures too.' },
    hasDebts: { label: 'Do you owe anyone or pay installments?', why: 'Payments are fixed costs, so they come off the top.' },
    debtTotal: { label: 'About how much do you owe in total?', why: 'Shows how long until you are debt-free at this pace.' },
    debtMonthly: { label: 'How much do you pay toward it each month?', why: 'This is set aside before anything else.' },
    savingsOnHand: { label: 'About how much do you have saved right now?', why: 'Decides how fast the safety net needs to grow.' },
    payday: { label: 'Which day of the month does it arrive?', why: 'Puts your payday on the calendar.' },
    goalKind: { label: 'What is it for?', why: 'Names the goal so you can find it later.', opts: { vacation: 'A trip', house: 'A home', car: 'A car', education: 'Education', wedding: 'A wedding', custom: 'Something else' } },
    hasGoal: { label: 'Are you saving for something specific?', why: 'A goal gets its own monthly amount.' },
    goalTarget: { label: 'How much does it cost?', why: 'Sets the monthly amount.' },
    goalMonths: { label: 'In how many months do you want it?', why: 'More time means a smaller monthly amount.' },
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
  known: { open: 'ما أعرفه', title: 'ما يعرفه بادي', sub: 'اضغط على أي شيء لتغييره. إجاباتك محفوظة في ملفك.', empty: 'لا شيء بعد.', change: 'تغيير', yes: 'نعم', no: 'لا' },
  stages: { found: 'ما وجدته', home: 'السكن', life: 'الحياة اليومية', debts: 'الديون', secure: 'الأمان', priorities: 'الأولويات' },
  progress: (pct) => `${pct}% معروف`,
  why: 'لماذا أسأل',
  cont: 'متابعة',
  yes: 'نعم',
  no: 'لا',
  confirm: 'صحيح',
  estimate: 'قدّر لي',
  buildNow: 'ابنِ خطتي الآن',
  opener: {
    kicker: 'Buddgy يستمع',
    working: 'أقرأ ما كتبته',
    title: 'احكِ لي عن وضعك',
    hint: 'جملة أو جملتان تكفيان: الراتب، الإيجار، العائلة، الديون، المدخرات. سأتخطى ما تخبرني به.',
    placeholder: 'مثال: أتقاضى 18,000 شهريًا، أستأجر شقة بـ 6,000، لدي طفلان وأدفع 800 شهريًا قسط قرض',
    examples: ['أعمل في شركة، أستأجر شقة، بلا ديون', 'عمل حر، دخلي يتغير كثيرًا، أعيش مع العائلة'],
    cta: 'متابعة',
    skip: 'تخطَّ واسألني',
    understood: (n) => (n === 1 ? 'التقطتُ معلومة واحدة' : `التقطتُ ${n} معلومات`),
    change: 'سأسألك عن الباقي. اضغط على أيقونة القائمة في أي وقت لتغيير إجابة.',
    cont: 'صحيح، تابع',
  },
  entities: { income: 'الراتب', debt: 'ديوني', savings: 'المدخرات', goals: { vacation: 'رحلة', house: 'منزل', car: 'سيارة', education: 'تعليم', wedding: 'زواج', custom: 'هدفي' } },
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
  q: {
    confirmIncome: { label: 'دخلك حوالي {n} شهريًا. صحيح؟', why: 'كل بند يُحسب على هذا الرقم.' },
    income: { label: 'كم تستلم شهريًا؟', why: 'تخطَّ إن لم يكن لديك دخل وسأبني الخطة على إنفاقك المتوقع.' },
    confirmBills: { label: 'وجدت {n} فواتير واشتراكات. أي شيء ناقص سأسألك عنه لاحقًا.', why: 'تصبح بنودًا ثابتة دون إعادة كتابتها.' },
    confirmDebts: { label: 'وجدت {n} ديون. سأسدد الحد الأدنى على الأقل.', why: 'الحد الأدنى تكلفة ثابتة، والسداد الإضافي يأتي بعدها.' },
    confirmGoals: { label: 'وجدت {n} أهداف وسأموّلها كما ضبطتها.', why: 'الأهداف تحتفظ بإعدادات تمويلها.' },
    housing: { label: 'كيف تسكن؟', why: 'السكن عادةً أكبر بند.', opts: { rent: 'أستأجر', own: 'أملك', family: 'مع العائلة', company: 'سكن الشركة' } },
    rent: { label: 'كم الإيجار أو القسط الشهري؟', why: 'بند ثابت كل شهر.' },
    rentIncludesUtilities: { label: 'هل يشمل المرافق؟', why: 'لتجنب حساب الكهرباء والماء مرتين.' },
    household: { label: 'من في أسرتك؟', why: 'البقالة والأمان تتناسب مع عدد الأفراد.', opts: { solo: 'أنا فقط', couple: 'اثنان', family: 'عائلة' } },
    dependents: { label: 'كم عدد المعالين؟', why: 'الأطفال يضيفون تكاليف الدراسة والرعاية.' },
    supportsOthers: { label: 'هل تدعم أسرة في مكان آخر؟', why: 'التحويلات المنتظمة تكلفة ثابتة فعلية.' },
    incomeStability: { label: 'ما مدى ثبات دخلك؟', why: 'الدخل المتذبذب يحتاج احتياطيًا أكبر.', opts: { fixed: 'ثابت', variable: 'متغير', mixed: 'مزيج' } },
    foodFrequency: { label: 'كم مرة تأكل خارج المنزل أو تطلب؟', why: 'يحدد بند المطاعم.', opts: { everyday: 'كل يوم', mostdays: 'معظم الأيام', sometimes: 'أحيانًا', rarely: 'نادرًا' } },
    lifestyle: { label: 'كيف تصف نمط حياتك؟', why: 'يحدد مساحة الإنفاق اليومي.', opts: { minimal: 'بسيط', balanced: 'متوازن', comfortable: 'مريح' } },
    transportMode: { label: 'كيف تتنقل؟', why: 'تكلفة التنقل تختلف كثيرًا حسب الوسيلة.', opts: { public: 'مواصلات عامة', car: 'سيارتي', taxi: 'سيارات أجرة', walk: 'سيرًا' } },
    emergencyMonths: { label: 'كم شهرًا من المصاريف تغطي شبكة أمانك؟', why: 'ثلاثة أشهر شائعة، وستة إذا كان دخلك متغيرًا أو تعول غيرك.' },
    investInterest: { label: 'هل تريد الاستثمار أيضًا؟', why: 'يضيف بند نمو بعد شبكة الأمان.' },
    priorities: { label: 'اختر حتى ثلاث أولويات', why: 'تحدد أين يذهب الفائض أولًا.', opts: { safety: 'شبكة الأمان', debt: 'سداد الدين', goals: 'الأهداف', invest: 'الاستثمار', enjoy: 'الاستمتاع', family: 'العائلة' } },
    rentCheck: { label: 'سجلاتك تُظهر نحو {n} شهريًا للإيجار. أيهما أقرب؟', why: 'سجلاتك غالبًا هي الأدق.', opts: { stated: 'ما أدخلته', records: 'ما تُظهره سجلاتي' } },
    lowMonth: { label: 'في شهر ضعيف، كم تستلم تقريبًا؟', why: 'الخطة مبنية على شهر ضعيف، فالشهر الجيد مكسب إضافي.' },
    cashHeavy: { label: 'هل تدفع غالبًا نقدًا؟', why: 'الإنفاق النقدي يسهل نسيانه، لذا سأعتمد أيضًا على أرقام معتادة.' },
    hasDebts: { label: 'هل عليك ديون أو أقساط؟', why: 'الأقساط تكاليف ثابتة تُخصم أولًا.' },
    debtTotal: { label: 'كم إجمالي ما عليك تقريبًا؟', why: 'يوضح المدة حتى تتخلص من الدين بهذا الوتيرة.' },
    debtMonthly: { label: 'كم تدفع منه شهريًا؟', why: 'يُخصص هذا قبل أي شيء آخر.' },
    savingsOnHand: { label: 'كم لديك مدخرًا الآن تقريبًا؟', why: 'يحدد سرعة نمو صندوق الطوارئ.' },
    payday: { label: 'في أي يوم من الشهر يصل؟', why: 'يضع يوم الراتب في التقويم.' },
    goalKind: { label: 'لأي غرض؟', why: 'يسمي الهدف لتجده لاحقًا.', opts: { vacation: 'رحلة', house: 'منزل', car: 'سيارة', education: 'تعليم', wedding: 'زواج', custom: 'شيء آخر' } },
    hasGoal: { label: 'هل تدخر لشيء محدد؟', why: 'الهدف يحصل على مبلغ شهري خاص به.' },
    goalTarget: { label: 'كم تبلغ تكلفته؟', why: 'يحدد المبلغ الشهري.' },
    goalMonths: { label: 'خلال كم شهرًا تريده؟', why: 'وقت أطول يعني مبلغًا شهريًا أصغر.' },
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
