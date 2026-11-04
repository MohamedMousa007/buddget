import { NODES } from '@/lib/budget/flow/nodes'

export interface FlowQuestionCopy {
  label: string
  why: string
  /** Option labels by value. */
  opts?: Record<string, string>
  /** Wording variants chosen from earlier answers (see `FlowNode.variant`). */
  variants?: Record<string, string>
}

type Pair = readonly [en: string, ar: string]

/** Option labels, English then Arabic. */
const OPTS: Record<string, Record<string, Pair>> = {
  incomeType: { salary: ['Salary', 'راتب'], freelance: ['Freelance', 'عمل حر'], business: ['My own business', 'نشاطي التجاري'], seasonal: ['Seasonal work', 'عمل موسمي'], mixed: ['Salary plus extras', 'راتب مع دخل إضافي'], benefits: ['Pension or benefits', 'معاش أو إعانات'], allowance: ['Allowance', 'مصروف'] },
  incomeStability: { fixed: ['Same every month', 'ثابت كل شهر'], variable: ['Changes a lot', 'يتغير كثيرًا'], mixed: ['Base plus extras', 'أساسي مع إضافات'] },
  jobSecurity: { secure: ['Secure', 'آمنة'], uncertain: ['Uncertain', 'غير مستقرة'], expecting_change: ['A change is coming', 'تغيير قادم'] },
  taxSetAside: { already: ['Yes, already', 'نعم، بالفعل'], not_yet: ['Not yet', 'ليس بعد'], not_needed: ['No tax on my income', 'لا ضريبة على دخلي'] },
  payFrequency: { monthly: ['Monthly', 'شهريًا'], biweekly: ['Every two weeks', 'كل أسبوعين'], weekly: ['Weekly', 'أسبوعيًا'] },
  housing: { rent: ['I rent', 'أستأجر'], own: ['I own', 'أمتلك'], family: ['With family', 'مع العائلة'], company: ['Company housing', 'سكن الشركة'] },
  ownType: { mortgage: ['Yes, a mortgage', 'نعم، قسط عقاري'], paid_off: ['No, it is paid off', 'لا، مسدّد'] },
  rentFreq: { monthly: ['Monthly', 'شهريًا'], quarterly: ['Every 3 months', 'كل 3 أشهر'], yearly: ['Yearly', 'سنويًا'] },
  rentCheck: { stated: ['What I entered', 'ما أدخلته'], records: ['What my records show', 'ما تُظهره سجلاتي'] },
  household: { solo: ['Just me', 'أنا فقط'], couple: ['Two of us', 'اثنان'], family: ['Family', 'عائلة'] },
  youngestChild: { under5: ['Under 5', 'أقل من 5'], school: ['School age', 'سن المدرسة'], teen: ['Teenager', 'مراهق'], adult: ['Grown up', 'بالغ'] },
  partnerRole: { shares: ['Earns, we share costs', 'يعمل ونتقاسم التكاليف'], separate: ['Earns, money kept separate', 'يعمل وأموالنا منفصلة'], no_income: ['Has no income', 'بلا دخل'], no_partner: ['No partner', 'لا شريك'] },
  transportMode: { public: ['Public', 'مواصلات عامة'], car: ['My car', 'سيارتي'], taxi: ['Taxis', 'سيارات أجرة'], walk: ['On foot', 'سيرًا'] },
  carOwnership: { owned: ['Paid off', 'مسدّدة'], financed: ['Financed', 'بالتقسيط'], leased: ['Leased', 'إيجار تمويلي'] },
  carOverlap: { listed: ['Yes, it is listed', 'نعم، مذكور'], separate: ['No, it is separate', 'لا، منفصل'], paid_off: ['The car is paid off', 'السيارة مسدّدة'] },
  foodFrequency: { everyday: ['Every day', 'كل يوم'], mostdays: ['Most days', 'معظم الأيام'], sometimes: ['Sometimes', 'أحيانًا'], rarely: ['Rarely', 'نادرًا'] },
  lifestyle: { minimal: ['Minimal', 'مقتصد'], balanced: ['Balanced', 'متوازن'], comfortable: ['Comfortable', 'مريح'] },
  healthCover: { full: ['Fully covered', 'مغطاة بالكامل'], partial: ['Partly covered', 'مغطاة جزئيًا'], none: ['Not covered', 'غير مغطاة'] },
  cardApr: { under15: ['Under 15%', 'أقل من 15٪'], '15_25': ['15 to 25%', 'من 15 إلى 25٪'], over25: ['Over 25%', 'أكثر من 25٪'], unknown: ['Not sure', 'لست متأكدًا'] },
  loanApr: { under15: ['Under 15%', 'أقل من 15٪'], '15_25': ['15 to 25%', 'من 15 إلى 25٪'], over25: ['Over 25%', 'أكثر من 25٪'], unknown: ['Not sure', 'لست متأكدًا'] },
  taxPlan: { plan: ['A payment plan', 'خطة سداد'], lump_sum: ['One payment soon', 'دفعة واحدة قريبًا'], none: ['Nothing arranged', 'لا شيء مرتب'] },
  debtStrategy: { avalanche: ['Highest interest first', 'الأعلى فائدة أولًا'], snowball: ['Smallest balance first', 'الأصغر رصيدًا أولًا'], balanced: ['You choose for me', 'اختر أنت لي'] },
  debtKinds: { card: ['Credit card', 'بطاقة ائتمان'], loan: ['Personal or car loan', 'قرض شخصي أو سيارة'], bnpl: ['Buy now, pay later', 'اشترِ الآن وادفع لاحقًا'], family: ['Family or friends', 'عائلة أو أصدقاء'], student: ['Student loan', 'قرض دراسي'], tax: ['Taxes or fines', 'ضرائب أو غرامات'] },
  saveTarget: { p10: ['10% of income', '10٪ من دخلي'], p20: ['20% of income', '20٪ من دخلي'], p30: ['30% of income', '30٪ من دخلي'], custom: ['An amount I choose', 'مبلغ أحدده'], unsure: ['Not sure', 'لست متأكدًا'] },
  saveObstacle: { dining: ['Eating out', 'الأكل خارج البيت'], shopping: ['Shopping', 'التسوق'], bills: ['Heavy bills', 'فواتير ثقيلة'], irregular: ['Irregular income', 'دخل غير منتظم'], debt: ['Debt payments', 'أقساط الدين'], unplanned: ['Unplanned spending', 'إنفاق غير مخطط'] },
  retirement: { employer: ['Employer plan or social insurance', 'خطة صاحب العمل أو التأمينات'], self: ['I save for it myself', 'أدّخر له بنفسي'], none: ['Nothing yet', 'لا شيء بعد'] },
  investing: { already: ['I already invest', 'أستثمر بالفعل'], want_to: ['I want to start', 'أريد أن أبدأ'], not_now: ['Not now', 'ليس الآن'] },
  zakatMode: { yes_auto: ['Yes, calculate it for me', 'نعم، احسبها لي'], yes_amount: ['Yes, I know the amount', 'نعم، أعرف المبلغ'], no: ['No', 'لا'] },
  goalKind: { vacation: ['Trip', 'رحلة'], house: ['Home', 'منزل'], car: ['Car', 'سيارة'], education: ['Education', 'تعليم'], wedding: ['Wedding', 'زواج'], pilgrimage: ['Hajj or Umrah', 'حج أو عمرة'], business: ['Business', 'مشروع'], other: ['Something else', 'شيء آخر'] },
  houseScope: { full_price: ['Full price', 'السعر كاملًا'], down_payment: ['Down payment', 'الدفعة الأولى'] },
  educationFor: { me: ['Me', 'لي'], child: ['A child', 'لطفل'] },
  goalTiming: { by_date: ['By a date', 'بتاريخ'], by_amount: ['A monthly amount', 'بمبلغ شهري'] },
  goalAdjust: { extend: ['Move the date later', 'تأجيل الموعد'], lower: ['Lower the target', 'خفض الهدف'], save_more: ['Find more to save', 'ادّخار أكثر'], keep: ['Keep it anyway', 'أبقِه كما هو'] },
  goalVsSafety: { goal_first: ['Goal first', 'الهدف أولًا'], balanced: ['Both together', 'الاثنان معًا'], safety_first: ['Safety first', 'الأمان أولًا'] },
  annualKinds: { car_yearly: ['Car insurance or renewal', 'تأمين السيارة أو تجديدها'], school_start: ['School start', 'بداية المدرسة'], travel: ['Travel', 'السفر'], festive: ['Festivals and gifts', 'الأعياد والهدايا'], home_repairs: ['Home repairs', 'إصلاحات المنزل'], medical: ['Medical', 'طبي'], renewals: ['Visas and renewals', 'تأشيرات وتجديدات'] },
  bigSoon: { baby: ['A baby', 'مولود'], wedding: ['A wedding', 'زفاف'], move: ['A move', 'انتقال'], car: ['A car', 'سيارة'], medical: ['Medical', 'علاج'] },
  priorities: { safety: ['Safety net', 'صندوق الأمان'], debt: ['Clear debt', 'سداد الدين'], goals: ['Goals', 'الأهداف'], invest: ['Invest', 'الاستثمار'], enjoy: ['Enjoy life', 'الاستمتاع'], family: ['Family', 'العائلة'] },
  housingChange: { stable: ['Stable', 'مستقر'], lease_end: ['Lease ends soon', 'ينتهي العقد قريبًا'], can_reduce: ['I can reduce it', 'أستطيع خفضه'], will_rise: ['Will go up', 'سيرتفع'] },
  deficitPlan: { lower_rent: ['Lower my housing cost', 'خفض تكلفة سكني'], refinance: ['Refinance a debt', 'إعادة جدولة دين'], extra_income: ['Earn extra', 'دخل إضافي'], pause_goals: ['Pause goals', 'إيقاف الأهداف مؤقتًا'], family_help: ['Help from family', 'مساعدة من العائلة'], none: ['Nothing for now', 'لا شيء الآن'] },
  cutFirst: { dining: ['Dining out', 'المطاعم'], fun: ['Fun', 'الترفيه'], shopping: ['Shopping', 'التسوق'], subscriptions: ['Subscriptions', 'الاشتراكات'], transport: ['Transport', 'المواصلات'], groceries: ['Groceries', 'البقالة'] },
}

/** Arabic question and reason, by question id. English comes from the question graph itself. */
const AR: Record<string, readonly [label: string, why: string]> = {
  confirmIncome: ['دخلك حوالي {income} شهريًا. صحيح؟', 'كل بند في الخطة يُحسب على هذا الرقم.'],
  income: ['كم يصلك صافيًا في شهر عادي؟', 'كل بند في الخطة يُحسب على هذا الرقم.'],
  incomeType: ['كيف تكسب دخلك؟', 'يحدد مدى ثبات الخطة.'],
  incomeStability: ['هل يتغير راتبك من شهر لآخر؟', 'الراتب الثابت والمتغير يُخطَّطان بشكل مختلف.'],
  jobSecurity: ['ما مدى أمان وظيفتك؟', 'الوظيفة غير المستقرة تحتاج صندوق أمان أكبر.'],
  lowMonth: ['كم تكسب في شهر ضعيف؟', 'نبني الخطة على شهرك الضعيف حتى لا تنهار.'],
  taxSetAside: ['هل تدّخر جزءًا للضرائب؟', 'الدخل الخاضع للضريبة ليس كله لك.'],
  taxPct: ['ما النسبة التي نحجزها؟', 'نحجزها قبل أي شيء آخر.'],
  payFrequency: ['كم مرة تتقاضى؟', 'يحدد موعد وصول المال وترتيب الفواتير.'],
  payday: ['في أي يوم من الشهر؟', 'يبدأ شهر خطتك من يوم الراتب.'],
  housing: ['أين تسكن؟', 'السكن عادةً أكبر بند.'],
  ownType: ['هل لا يزال عليك قسط عقاري؟', 'القسط العقاري تكلفة ثابتة وهو دين أيضًا.'],
  rent: ['كم إيجارك؟', 'أكبر بند ثابت في أغلب الخطط.'],
  rentFreq: ['كل كم تدفعه؟', 'الإيجار ربع السنوي أو السنوي يُوزَّع على الأشهر.'],
  rentCheck: ['سجلاتك تُظهر إيجارًا مختلفًا. أيهما الصحيح؟', 'سجلاتك وإجابتك مختلفتان.'],
  rentIncludesUtilities: ['هل يشمل الكهرباء والمياه؟', 'وإلا أضفناها كفاتورة.'],
  mortgagePayment: ['كم قسطك العقاري الشهري؟', 'يُحتسب كسكن لا كقرض.'],
  mortgageYears: ['كم سنة تقريبًا تبقّت؟', 'نعرف بها مدة استمراره.'],
  propertyCosts: ['هل هناك رسوم مبنى أو صيانة أو ضريبة عقارية شهرية؟', 'للتملك تكاليف جارية.'],
  familyContribution: ['هل تساهم في تكاليف البيت؟', 'التزام منتظم.'],
  familyContributionAmount: ['كم شهريًا؟', 'يُحتسب كسكن.'],
  household: ['من يشاركك بيتك؟', 'يحدد البقالة والمرافق والأمان.'],
  dependents: ['كم عدد الأبناء أو المعالين؟', 'كل معال يرفع الأساسيات وهدف الأمان.'],
  youngestChild: ['كم عمر الأصغر؟', 'يحدد بين الحضانة والمدرسة.'],
  schoolFees: ['كم تبلغ تكاليف المدرسة شهريًا؟', 'غالبًا ثاني أكبر تكلفة ثابتة.'],
  childcare: ['كم تبلغ تكلفة رعاية الأطفال شهريًا؟', 'تكلفة ثابتة حتى سن المدرسة.'],
  partnerRole: ['كيف يشارك شريكك؟', 'تُخطَّط التكاليف المشتركة على حصتك فقط.'],
  partnerSharePct: ['ما نسبة التكاليف المشتركة التي تغطيها؟', 'خطتك تغطي حصتك لا الفاتورة كاملة.'],
  supportsOthers: ['هل ترسل مالًا لعائلتك بانتظام؟', 'التحويلات التزام ثابت.'],
  supportAmount: ['كم شهريًا؟', 'يُحتسب كالتزام ثابت.'],
  confirmBills: ['وجدنا {n} فواتير واشتراكات منتظمة. هل هي صحيحة؟', 'تُربط بخطتك.'],
  transportMode: ['كيف تتنقل غالبًا؟', 'المواصلات ثاني أكبر بند يومي.'],
  carOwnership: ['هل سيارتك مسدّدة بالكامل؟', 'قسط السيارة التزام ثابت.'],
  carOverlap: ['هل قسط السيارة أحد القروض التي ذكرتها؟', 'حتى لا يُحتسب مرتين.'],
  carPayment: ['كم القسط الشهري؟', 'يُحتسب مع ديونك.'],
  foodFrequency: ['كم مرة تأكل خارج البيت أو تطلب؟', 'يحدد توزيع المطاعم والبقالة.'],
  lifestyle: ['كيف تصف أسلوب إنفاقك؟', 'يرفع سقوف الإنفاق اليومي أو يخفضها.'],
  healthCover: ['هل صحتك مغطاة بتأمين؟', 'التكاليف الصحية غير المغطاة تحتاج بندًا.'],
  healthCost: ['كم تنفق على الصحة شهريًا؟', 'تكاليف لا يغطيها التأمين.'],
  chronicMeds: ['هل تتناول دواءً بانتظام؟', 'تكلفة ثابتة يجب التخطيط لها.'],
  chronicAmount: ['كم تقريبًا شهريًا؟', 'تُحتسب كصحة.'],
  cashHeavy: ['هل تدفع غالبًا نقدًا؟', 'الإنفاق النقدي لا تُظهره سجلاتك كاملًا.'],
  confirmDebts: ['وجدنا {n} ديون وأقساط. هل هي صحيحة؟', 'حدودها الدنيا محسوبة في خطتك.'],
  moreDebts: ['هل عليك شيء آخر، مثل بطاقة أو عائلة أو اشترِ الآن وادفع لاحقًا؟', 'فقط ما لا نتتبعه بعد.'],
  hasDebts: ['هل عليك ديون في أي مكان؟', 'الدين الغالي يسبق الادخار.'],
  debtKinds: ['ما أنواع الدين؟', 'كل نوع يُسدَّد بطريقة مختلفة.'],
  cardPayFull: ['هل تسدد بطاقتك بالكامل كل شهر؟', 'إن فعلت فهي إنفاق لا دين.'],
  cardBalance: ['كم الرصيد الحالي على البطاقة؟', 'يحدد ترتيب السداد.'],
  cardMin: ['كم تدفع عليها شهريًا؟', 'الحد الأدنى أولًا.'],
  cardApr: ['تقريبًا كم الفائدة التي تحتسبها؟', 'الدين الأغلى يُسدَّد أولًا.'],
  loanBalance: ['كم تبقّى على قرضك؟', 'يحدد ترتيب السداد.'],
  loanMin: ['كم القسط الشهري؟', 'يُحتسب كتكلفة ثابتة.'],
  loanApr: ['تقريبًا كم الفائدة التي يحتسبها؟', 'الدين الأغلى يُسدَّد أولًا.'],
  bnplMonthly: ['كم مجموع أقساطك شهريًا؟', 'تُحتسب كتكلفة ثابتة حتى تنتهي.'],
  bnplLeft: ['كم شهرًا حتى آخر قسط؟', 'الخطة تحرر المبلغ عند انتهائها.'],
  familyOwed: ['كم تدين به للعائلة أو الأصدقاء؟', 'الدين غير الرسمي يُحتسب أيضًا.'],
  familyMonthly: ['كم اتفقت على سداده شهريًا؟', 'الصفر مقبول إن لم يكن هناك جدول.'],
  studentBalance: ['كم تبقّى على قرض الدراسة؟', 'غالبًا أقل الديون أولوية.'],
  studentMin: ['كم القسط الشهري؟', 'صفر إن كان مؤجلًا.'],
  taxOwed: ['كم عليك من ضرائب متأخرة أو غرامات؟', 'غالبًا عليها غرامات لذا تأتي أولًا.'],
  taxPlan: ['هل هناك خطة سداد؟', 'الخطة تحدد المبلغ الشهري.'],
  behind: ['هل أنت متأخر في سداد أي دفعة الآن؟', 'التأخر يغيّر ترتيب كل شيء.'],
  arrears: ['كم المبلغ المتأخر؟', 'نسدده قبل أي شيء آخر.'],
  debtStrategy: ['كيف تريد سداد ديونك؟', 'الأصغر أولًا يعطي زخمًا. الأعلى فائدة يوفّر أكثر.'],
  debtExtra: ['فوق الحد الأدنى، كم يمكنك دفعه إضافيًا للديون؟', 'يحدد تاريخ تحررك من الدين.'],
  saveTarget: ['كم تريد أن تدّخر كل شهر؟', 'نبني بقية الخطة حوله.'],
  saveCustom: ['كم؟', 'هدفك الخاص.'],
  saveObstacle: ['ما الذي يصعّب الادخار الآن؟', 'نشدّ هذه المجالات أولًا.'],
  savingsOnHand: ['كم لديك مدّخرًا الآن؟', 'يحدد مدى إلحاح صندوق الأمان.'],
  emergencyMonths: ['كم شهرًا من التكاليف يجب أن يغطي صندوق أمانك؟', 'ثلاثة معيار شائع، وستة إن كان دخلك أو أسرتك يحتاجان أكثر.'],
  lifeInsurance: ['هل لديك تأمين حياة أو حماية دخل؟', 'المعالون يعتمدون على دخلك.'],
  insurancePremium: ['كم القسط الشهري؟', 'تكلفة ثابتة.'],
  retirement: ['كيف تدّخر للتقاعد؟', 'المعاش أو التأمينات الاجتماعية يُحتسبان.'],
  retirementAmount: ['كم تضع شهريًا؟', 'يُحتسب كادخار.'],
  investing: ['هل تستثمر أو تريد ذلك؟', 'يبقى في الخطة حتى لا يتوقف. يُعرض فقط عند ضبط الدين والأمان.'],
  investMonthly: ['كم شهريًا؟', 'يُحتسب كادخار.'],
  zakatMode: ['هل تخصّص مالًا للزكاة أو العطاء؟', 'نحجزه قبل أن تنفق.'],
  zakatAmount: ['كم شهريًا؟', 'يُحجز أولًا.'],
  confirmGoals: ['وجدنا {n} أهداف. هل نُبقيها في الخطة؟', 'سحبها الشهري محسوب بالفعل.'],
  hasGoal: ['هل هناك شيء كبير تدّخر له؟', 'الأهداف لها بند خاص.'],
  goalKind: ['ما هو؟', 'يحدد الأسئلة التالية.'],
  houseScope: ['هل هذا السعر كاملًا أم الدفعة الأولى؟', 'نخطط فقط ما عليك ادخاره.'],
  educationFor: ['هل التعليم لك أم لطفل؟', 'الطفل غالبًا يعني موعد بدء أبعد.'],
  goalTarget: ['كم تكلفته؟', 'المبلغ الكلي الذي تحتاجه.'],
  goalSaved: ['كم خصّصت له حتى الآن؟', 'يُحتسب من الإجمالي.'],
  goalTiming: ['هل تحتاجه بتاريخ معين أم تحدد مبلغ الادخار؟', 'في الحالتين نحسب الآخر.'],
  goalMonths: ['خلال كم شهرًا؟', 'يحدد المبلغ الشهري.'],
  goalMonthly: ['كم تستطيع ادخاره له شهريًا؟', 'نحسب متى تصل.'],
  anotherGoal: ['يوجد متسع. هل نضيف هدفًا آخر؟', 'يُعرض فقط حين يناسب الهدف الأول بسهولة.'],
  goal2Target: ['كم يكلف الهدف الثاني؟', 'يُخطَّط بعد الأول.'],
  goal2Months: ['خلال كم شهرًا؟', 'يحدد مبلغه الشهري.'],
  annualKinds: ['هل هناك تكاليف كبيرة تأتي مرة أو مرتين في السنة؟', 'نوزعها على الأشهر حتى لا تأتي دفعة واحدة.'],
  annualTotal: ['كم تبلغ في السنة إجمالًا؟', 'تُقسم على اثني عشر وتُحجز.'],
  bigSoon: ['هل هناك شيء كبير قادم خلال سنتين؟', 'مولود أو زفاف أو انتقال يغيّر ما يجب أن تحميه الخطة.'],
  bigSoonAmount: ['كم ستكلف إجمالًا تقريبًا؟', 'تُحجز شهريًا حتى موعدها.'],
  bigSoonMonths: ['بعد كم شهرًا؟', 'يحدد المبلغ الشهري.'],
  priorities: ['ما الأهم لك الآن؟', 'اختر حتى ثلاثة. عند التعادل يُقدَّم الأول.'],
  securityLean: ['ادخار قوي أم عيش مريح؟', 'يحرك الخطة كلها على هذا الخط. يُسأل فقط عند وجود سعة للاختيار.'],
  housingChange: ['السكن يأخذ حصة كبيرة. هل قد يتغير؟', 'يحدد هل نخطط لتخفيف أم زيادة.'],
  deficitPlan: ['تكاليفك الثابتة لا تترك تقريبًا شيئًا. ماذا يمكن أن يتغير؟', 'نبني خطة تثبيت حول ما يمكنك تحريكه.'],
  extraIncome: ['كم دخلًا إضافيًا يمكنك إضافته؟', 'يظهر كخطة محتملة ولا يُحتسب بعد.'],
  goalAdjust: ['هذا الهدف يحتاج أكثر مما تستطيع الخطة. ماذا تريد؟', 'نفضّل تعديله الآن على أن يفشل لاحقًا.'],
  goalMonthsNew: ['انقله إلى كم شهرًا؟', 'موعد أبعد يخفض المبلغ الشهري.'],
  goalTargetNew: ['ما الهدف المناسب؟', 'هدف أقل يناسب الخطة.'],
  goalVsSafety: ['مدخراتك قليلة. الهدف أولًا أم الأمان أولًا؟', 'لا يمكن أن يكون كلاهما أولًا.'],
  cutFirst: ['إن ضاق المال، ما الذي نقلّصه أولًا؟', 'خطتك تقتطع من هذه البنود قبل غيرها.'],
}

const VARIANTS: Record<string, Record<string, Pair>> = {
  hasDebts: {
    mortgage: ['Besides your mortgage, do you owe money anywhere?', 'إضافةً إلى قسطك العقاري، هل عليك ديون في أي مكان؟'],
    car: ['Besides your car payment, do you owe money anywhere?', 'إضافةً إلى قسط سيارتك، هل عليك ديون في أي مكان؟'],
  },
  debtKinds: { known: ['What else do you owe?', 'ماذا أيضًا عليك؟'] },
  rentIncludesUtilities: { company: ['Does your company housing cover electricity and water?', 'هل سكن الشركة يشمل الكهرباء والمياه؟'] },
  goalTarget: { down: ['How much is the down payment?', 'كم الدفعة الأولى؟'] },
}

const humanize = (v: string) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function build(lang: 0 | 1): Record<string, FlowQuestionCopy> {
  return Object.fromEntries(
    NODES.map((n) => {
      const opts = n.opts ? Object.fromEntries(n.opts.map((o) => [o, OPTS[n.id]?.[o]?.[lang] ?? (lang === 0 ? humanize(o) : o)])) : undefined
      const variants = VARIANTS[n.id] ? Object.fromEntries(Object.entries(VARIANTS[n.id]).map(([k, v]) => [k, v[lang]])) : undefined
      const [label, why] = lang === 0 ? [n.q, n.why] : (AR[n.id] ?? [n.q, n.why])
      return [n.id, { label, why, ...(opts ? { opts } : {}), ...(variants ? { variants } : {}) }]
    }),
  )
}

export const flowCopyEn = build(0)
export const flowCopyAr = build(1)
