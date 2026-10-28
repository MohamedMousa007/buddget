/** Copy that used to live in per-component en/ar tables, now typed and checked for parity with the rest of the dictionary. */
export interface InlineCopy {
  payCycle: {
    title: string
    question: string
    hint: string
    earlier: string
    later: string
    today: string
    current: string
    note: string
    close: string
  }
  currencyDual: {
    title: string
    main: string
    second: string
    off: string
    offHint: string
    previewTitle: string
    sampleTxn: string
    previewOff: string
    close: string
    tabs: string
  }
  currencyPicker: {
    title: string
    close: string
    searchPlaceholder: string
    searchAria: string
    noMatch: (query: string) => string
    common: string
    all: string
  }
  yearPicker: { typeYear: string; noMatch: string }
  buddgyContinue: string
  memoryWords: {
    household: Record<string, string>
    food: Record<string, string>
    transport: Record<string, string>
    tier: Record<string, string>
    housing: Record<string, string>
    stability: Record<string, string>
    rent: string
    housingLabel: string
    dependents: string
    supports: string
    income: string
    car: string
    lean: string
    invest: string
    yes: string
    no: string
    notSet: string
    kinds: { fact: string; preference: string; constraint: string }
  }
}

export const inlineCopyEn: InlineCopy = {
  payCycle: {
    title: 'Pay cycle',
    question: 'My month starts on day',
    hint: 'Usually the day your salary lands.',
    earlier: 'Earlier day',
    later: 'Later day',
    today: 'today',
    current: 'Your current cycle',
    note: 'Past entries keep their dates; your months are cut differently from now on.',
    close: 'Close',
  },
  currencyDual: {
    title: 'Currencies',
    main: 'Main',
    second: 'Second',
    off: 'Off',
    offHint: 'Amounts show in your main currency only',
    previewTitle: 'How a second currency shows',
    sampleTxn: 'Groceries',
    previewOff: 'Pick a currency below and every amount in Flow and on your heroes shows its equivalent underneath.',
    close: 'Close',
    tabs: 'Currency to change',
  },
  currencyPicker: {
    title: 'Currency',
    close: 'Close',
    searchPlaceholder: 'Search currency or country',
    searchAria: 'Search currency',
    noMatch: (query) => `No currency matches “${query}”`,
    common: 'Common',
    all: 'All currencies',
  },
  yearPicker: { typeYear: 'Type a year…', noMatch: 'No matching year' },
  buddgyContinue: 'Continue',
  memoryWords: {
    household: { solo: 'Just me', couple: 'Couple', family: 'Family' },
    food: { everyday: 'Every day', mostdays: 'Most days', sometimes: 'Sometimes', rarely: 'Rarely' },
    transport: { public: 'Public transport', car: 'Car', taxi: 'Taxi', walk: 'Walking' },
    tier: { minimal: 'Minimal', balanced: 'Balanced', comfortable: 'Comfortable' },
    housing: { rent: 'Renting', own: 'Own home', family: 'With family', company: 'Company housing' },
    stability: { fixed: 'Fixed', variable: 'Variable', mixed: 'Mixed' },
    rent: 'Rent',
    housingLabel: 'Housing',
    dependents: 'Dependents',
    supports: 'Supports others',
    income: 'Income',
    car: 'Has a car',
    lean: 'Saving vs comfort',
    invest: 'Interested in investing',
    yes: 'Yes',
    no: 'No',
    notSet: 'Not set',
    kinds: { fact: 'Facts', preference: 'Preferences', constraint: 'Limits' },
  },
}

export const inlineCopyAr: InlineCopy = {
  payCycle: {
    title: 'دورة الراتب',
    question: 'يبدأ شهري في اليوم',
    hint: 'غالباً يوم وصول الراتب.',
    earlier: 'يوم أبكر',
    later: 'يوم أبعد',
    today: 'اليوم',
    current: 'دورتك الحالية',
    note: 'تحتفظ الإدخالات السابقة بتواريخها، وتُقسَّم شهورك بشكل مختلف من الآن فصاعداً.',
    close: 'إغلاق',
  },
  currencyDual: {
    title: 'العملات',
    main: 'الأساسية',
    second: 'الثانية',
    off: 'إيقاف',
    offHint: 'تظهر المبالغ بالعملة الأساسية فقط',
    previewTitle: 'كيف تظهر العملة الثانية',
    sampleTxn: 'بقالة',
    previewOff: 'اختر عملة من الأسفل ليظهر مقابل كل مبلغ في التدفق وعلى شاشاتك الرئيسية تحته.',
    close: 'إغلاق',
    tabs: 'العملة المراد تغييرها',
  },
  currencyPicker: {
    title: 'العملة',
    close: 'إغلاق',
    searchPlaceholder: 'ابحث عن عملة أو دولة',
    searchAria: 'بحث عن عملة',
    noMatch: (query) => `لا توجد عملة تطابق “${query}”`,
    common: 'الأكثر استخداماً',
    all: 'كل العملات',
  },
  yearPicker: { typeYear: 'اكتب سنة…', noMatch: 'لا توجد سنة مطابقة' },
  buddgyContinue: 'أكمل',
  memoryWords: {
    household: { solo: 'أنا فقط', couple: 'زوجان', family: 'عائلة' },
    food: { everyday: 'كل يوم', mostdays: 'معظم الأيام', sometimes: 'أحياناً', rarely: 'نادراً' },
    transport: { public: 'مواصلات عامة', car: 'سيارة', taxi: 'تاكسي', walk: 'مشياً' },
    tier: { minimal: 'بسيط', balanced: 'متوازن', comfortable: 'مريح' },
    housing: { rent: 'إيجار', own: 'ملك', family: 'مع العائلة', company: 'سكن الشركة' },
    stability: { fixed: 'ثابت', variable: 'متغير', mixed: 'مختلط' },
    rent: 'الإيجار',
    housingLabel: 'السكن',
    dependents: 'المعالون',
    supports: 'تعول آخرين',
    income: 'الدخل',
    car: 'لديك سيارة',
    lean: 'الادخار مقابل الراحة',
    invest: 'مهتم بالاستثمار',
    yes: 'نعم',
    no: 'لا',
    notSet: 'غير محدد',
    kinds: { fact: 'حقائق', preference: 'تفضيلات', constraint: 'حدود' },
  },
}
