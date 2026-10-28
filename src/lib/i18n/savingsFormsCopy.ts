export interface SavingsFormsCopy {
  /** Display names for pockets the app creates itself; the stored English name stays the key. */
  systemNames: { monthlySavings: string }
  identity: {
    types: { bank: string; cash: string; gold: string; stablecoin: string; vault: string }
    matures: (month: string, year: number) => string
  }
  pocketKinds: Record<'bank' | 'wallet' | 'cash' | 'certificate' | 'stablecoin' | 'other', { label: string; sub: string }>
  pocket: {
    newTitle: (kind: string) => string
    linked: string
    newPocket: string
    provider: string
    other: string
    last4: string
    maturesOn: string
    pocketName: string
    inItNow: string
    currency: string
    colour: string
    alsoPayment: string
    alsoPaymentSub: string
    create: string
  }
  zakat: {
    title: string
    due: string
    notDue: string
    zakatableLine: (pct: string, amount: string, unit: string) => string
    underLine: (gap: string, unit: string) => string
    nisab: (amount: string, unit: string) => string
    hawlEnds: (date: string) => string
    whatCounts: string
    cash: string
    cashSub: string
    gold: string
    goldSub: string
    crypto: string
    cryptoSub: string
    stocks: string
    stocksSub: (forTrading: boolean) => string
    property: string
    propertySub: string
    notCounted: string
    debts: string
    debtsSub: string
    zakatableWealth: string
    stockHold: string
    longTerm: string
    longTermSub: string
    forTrading: string
    forTradingSub: string
    explainer: string
  }
  asset: {
    titles: { gold: string; crypto: string; stock: string; property: string }
    unitSuffix: { grams: string; pounds: string; ounces: string }
    karat: string
    pure: (pure: string) => string
    perGram: (price: string) => string
    countedAs: string
    grams: string
    goldPounds: string
    ounces: string
    howMuch: string
    rowWillSay: (grams: string, qty: string, unit: string) => string
    coin: string
    livePrice: string
    other: string
    typeIt: string
    symbol: string
    coins: string
    ticker: string
    shares: string
    size: string
    yourShare: string
    shopWouldPay: string
    worthToday: string
    liveValuation: string
    priceRefreshing: string
    moneySource: string
    total: string
    addGold: (qty: string, unit: string, karat: number) => string
    addInvestment: string
  }
}

export const savingsFormsCopyEn: SavingsFormsCopy = {
  systemNames: { monthlySavings: 'Monthly Savings' },
  identity: {
    types: { bank: 'Bank account', cash: 'Cash', gold: 'Gold', stablecoin: 'Stablecoin', vault: 'Monthly Savings' },
    matures: (month, year) => `matures ${month} ${year}`,
  },
  pocketKinds: {
    bank: { label: 'Bank account', sub: 'Current or savings' },
    wallet: { label: 'Mobile wallet', sub: 'Vodafone Cash, InstaPay' },
    cash: { label: 'Cash', sub: 'At home or in a safe' },
    certificate: { label: 'Certificate', sub: 'Fixed term, matures' },
    stablecoin: { label: 'Stablecoin', sub: 'USDT and friends' },
    other: { label: 'Something else', sub: 'Name it, pick an icon' },
  },
  pocket: {
    newTitle: (kind) => `New ${kind.toLowerCase()}`,
    linked: 'Linked',
    newPocket: 'Your new pocket',
    provider: 'Provider',
    other: 'Other',
    last4: 'Last 4 digits',
    maturesOn: 'Matures on',
    pocketName: 'Pocket name',
    inItNow: 'What’s in it now',
    currency: 'Currency',
    colour: 'Colour',
    alsoPayment: 'Also add as a payment method',
    alsoPaymentSub: 'So you can spend from it too',
    create: 'Create pocket',
  },
  zakat: {
    title: 'Zakat',
    due: 'Zakat is due',
    notDue: 'No zakat due',
    zakatableLine: (pct, amount, unit) => `${pct} × ${amount} ${unit} zakatable`,
    underLine: (gap, unit) => `You are ${gap} ${unit} under the line`,
    nisab: (amount, unit) => `Nisab · ${amount} ${unit}`,
    hawlEnds: (date) => `Hawl ends ${date}`,
    whatCounts: 'What counts',
    cash: 'Cash & savings',
    cashSub: 'Every pocket you hold',
    gold: 'Gold',
    goldSub: 'At today’s sell price',
    crypto: 'Crypto',
    cryptoSub: 'Treated like cash',
    stocks: 'Stocks',
    stocksSub: (forTrading) => `${forTrading ? 'For trading · 100%' : 'Long-term · 30%'} counted`,
    property: 'Property',
    propertySub: 'Not counted — only rent you kept',
    notCounted: 'Not counted',
    debts: 'Debts due this year',
    debtsSub: 'Subtracted from your wealth',
    zakatableWealth: 'Zakatable wealth',
    stockHold: 'How you hold stocks',
    longTerm: 'Long-term',
    longTermSub: '30% counted',
    forTrading: 'For trading',
    forTradingSub: '100% counted',
    explainer:
      'Zakat is 2.5% of the wealth you have held for one lunar year above nisab. A home you live in and land you rent out are not counted — only the rent you kept. Buddget follows the majority view; check anything unusual with someone you trust.',
  },
  asset: {
    titles: { gold: 'Add gold', crypto: 'Add crypto', stock: 'Add a position', property: 'Add property' },
    unitSuffix: { grams: 'g', pounds: 'pounds', ounces: 'oz' },
    karat: 'Karat',
    pure: (pure) => `${pure} pure`,
    perGram: (price) => `${price}/g`,
    countedAs: 'Counted as',
    grams: 'Grams',
    goldPounds: 'Gold pounds',
    ounces: 'Ounces',
    howMuch: 'How much',
    rowWillSay: (grams, qty, unit) => `= ${grams} g. Your row will say “${qty} ${unit}”.`,
    coin: 'Coin',
    livePrice: 'live price',
    other: 'Other',
    typeIt: 'type it',
    symbol: 'Symbol',
    coins: 'coins',
    ticker: 'Ticker',
    shares: 'Shares',
    size: 'Size',
    yourShare: 'Your share',
    shopWouldPay: 'What a shop would pay you today',
    worthToday: 'What it is worth today',
    liveValuation: 'Live valuation',
    priceRefreshing: 'Live price refreshing. The value will appear shortly.',
    moneySource: 'Where did the money come from?',
    total: 'Total',
    addGold: (qty, unit, karat) => `Add ${qty} ${unit} of ${karat}k`,
    addInvestment: 'Add investment',
  },
}

export const savingsFormsCopyAr: SavingsFormsCopy = {
  systemNames: { monthlySavings: 'المدخرات الشهرية' },
  identity: {
    types: { bank: 'حساب بنكي', cash: 'نقد', gold: 'ذهب', stablecoin: 'عملة مستقرة', vault: 'المدخرات الشهرية' },
    matures: (month, year) => `يحين استحقاقه ${month} ${year}`,
  },
  pocketKinds: {
    bank: { label: 'حساب بنكي', sub: 'الحساب الجاري أو التوفير' },
    wallet: { label: 'محفظة إلكترونية', sub: 'فودافون كاش، إنستاباي' },
    cash: { label: 'نقد', sub: 'في المنزل أو في خزنة' },
    certificate: { label: 'شهادة ادخار', sub: 'مدة ثابتة وتاريخ استحقاق' },
    stablecoin: { label: 'عملة مستقرة', sub: 'مثل USDT' },
    other: { label: 'شيء آخر', sub: 'سمّه واختر أيقونة' },
  },
  pocket: {
    newTitle: (kind) => `${kind} جديد`,
    linked: 'مرتبط',
    newPocket: 'جيبك الجديد',
    provider: 'الجهة',
    other: 'أخرى',
    last4: 'آخر 4 أرقام',
    maturesOn: 'تاريخ الاستحقاق',
    pocketName: 'اسم الجيب',
    inItNow: 'ما فيها الآن',
    currency: 'العملة',
    colour: 'اللون',
    alsoPayment: 'إضافتها أيضاً كطريقة دفع',
    alsoPaymentSub: 'لتتمكن من الإنفاق منها أيضاً',
    create: 'إنشاء الجيب',
  },
  zakat: {
    title: 'الزكاة',
    due: 'الزكاة واجبة',
    notDue: 'لا زكاة مستحقة',
    zakatableLine: (pct, amount, unit) => `${pct} × ${amount} ${unit} مال زكوي`,
    underLine: (gap, unit) => `أنت دون الحد بمقدار ${gap} ${unit}`,
    nisab: (amount, unit) => `النصاب · ${amount} ${unit}`,
    hawlEnds: (date) => `ينتهي الحول ${date}`,
    whatCounts: 'ما يُحتسب',
    cash: 'النقد والمدخرات',
    cashSub: 'كل المحافظ التي تملكها',
    gold: 'الذهب',
    goldSub: 'بسعر البيع اليوم',
    crypto: 'العملات الرقمية',
    cryptoSub: 'تُعامل مثل النقد',
    stocks: 'الأسهم',
    stocksSub: (forTrading) => `${forTrading ? 'للمتاجرة · 100%' : 'طويلة الأجل · 30%'} تُحتسب`,
    property: 'العقارات',
    propertySub: 'لا تُحتسب، فقط الإيجار الذي ادّخرته',
    notCounted: 'لا تُحتسب',
    debts: 'ديون مستحقة هذا العام',
    debtsSub: 'تُخصم من ثروتك',
    zakatableWealth: 'المال الزكوي',
    stockHold: 'كيف تحتفظ بالأسهم',
    longTerm: 'طويلة الأجل',
    longTermSub: '30% تُحتسب',
    forTrading: 'للمتاجرة',
    forTradingSub: '100% تُحتسب',
    explainer:
      'الزكاة هي 2.5% من المال الذي مضى عليه عام هجري كامل وبلغ النصاب. لا يُحتسب المنزل الذي تسكنه ولا الأرض المؤجّرة، بل الإيجار الذي ادّخرته فقط. يتبع Buddget رأي الجمهور، فاسأل من تثق به في أي حالة غير معتادة.',
  },
  asset: {
    titles: { gold: 'إضافة ذهب', crypto: 'إضافة عملة رقمية', stock: 'إضافة مركز استثماري', property: 'إضافة عقار' },
    unitSuffix: { grams: 'جم', pounds: 'جنيهات', ounces: 'أونصة' },
    karat: 'العيار',
    pure: (pure) => `نقاء ${pure}`,
    perGram: (price) => `${price}/جم`,
    countedAs: 'يُحتسب بوحدة',
    grams: 'جرامات',
    goldPounds: 'جنيهات ذهب',
    ounces: 'أونصات',
    howMuch: 'الكمية',
    rowWillSay: (grams, qty, unit) => `= ${grams} جم. سيظهر في القائمة “${qty} ${unit}”.`,
    coin: 'عملة معدنية',
    livePrice: 'سعر مباشر',
    other: 'أخرى',
    typeIt: 'اكتبها',
    symbol: 'الرمز',
    coins: 'عملات',
    ticker: 'رمز السهم',
    shares: 'الأسهم',
    size: 'المساحة',
    yourShare: 'حصتك',
    shopWouldPay: 'ما قد يدفعه محل لك اليوم',
    worthToday: 'قيمته اليوم',
    liveValuation: 'تقييم مباشر',
    priceRefreshing: 'جارٍ تحديث السعر المباشر. ستظهر القيمة قريباً.',
    moneySource: 'من أين جاء المال؟',
    total: 'الإجمالي',
    addGold: (qty, unit, karat) => `إضافة ${qty} ${unit} من عيار ${karat}`,
    addInvestment: 'إضافة استثمار',
  },
}
