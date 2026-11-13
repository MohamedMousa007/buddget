/** Copy for the segment page, the review mode and the by-hand builder. Money and dates arrive pre-formatted. */
export interface BudgetSegmentCopy {
  back: string
  empty: string
  add: (segment: string) => string
  hero: {
    left: string
    planned: string
    ofPlanned: (amount: string) => string
    share: (pct: string) => string
    perDayToSpend: (amount: string) => string
  }
  stat: {
    spent: string; perDay: string; vsPace: string; lines: string; share: string; planned: string
    paid: string; nextDue: string; left: string
    totalOwed: string; debtFree: string; minimums: string
    monthsHeld: string; target: string; reachedBy: string
    saved: string; targets: string; perMonth: string
    perMonthSubs: string; charged: string; yearly: string
    none: string
  }
  line: { left: (a: string) => string; over: (a: string) => string; ofCap: (a: string) => string; dueOn: (d: number) => string }
  extra: {
    payoffOrder: string
    firstDebt: (name: string) => string
    nextCharge: (name: string, date: string) => string
    chargesLeft: (n: number) => string
    allCharged: string
    safetyCovers: (months: string, target: number) => string
    goalPercent: (pct: number) => string
    zakat: string
    whereItWent: string
  }
  buddgy: { everydayOver: (name: string, amount: string) => string }
  review: {
    looksRight: string
    checked: string
    estimatedNote: string
    reopen: string
    checkFlagged: (n: number) => string
    activate: string
    blockedFlagged: string
    blockedOver: string
    headline: { check: (n: number) => string; ready: string; over: (amount: string) => string }
    fact: { by: (m: string) => string; around: (m: string) => string; unknown: string }
    askBuddgy: string
  }
  build: {
    useMyData: string
    useMyDataSub: string
    startBlank: string
    plannedSoFar: string
    startHere: string
    emptyRow: string
    skip: string
    skipped: string
    undoSkip: string
    done: string
    doneNext: (segment: string) => string
    finish: string
    saveAndAdd: string
  }
}

export const budgetSegmentCopyEn: BudgetSegmentCopy = {
  back: 'Budget',
  empty: 'Nothing here yet. Add the first line.',
  add: (s) => `Add to ${s.toLowerCase()}`,
  hero: {
    left: 'Left',
    planned: 'Planned',
    ofPlanned: (a) => `of ${a} planned`,
    share: (p) => `${p} of income`,
    perDayToSpend: (a) => `${a} a day to spend`,
  },
  stat: {
    spent: 'Spent', perDay: 'Per day', vsPace: 'Vs pace', lines: 'Lines', share: 'Of income', planned: 'Planned',
    paid: 'Paid', nextDue: 'Next due', left: 'Left',
    totalOwed: 'Total owed', debtFree: 'Debt-free', minimums: 'Minimums',
    monthsHeld: 'Months held', target: 'Target', reachedBy: 'Reached by',
    saved: 'Saved', targets: 'Targets', perMonth: 'Per month',
    perMonthSubs: 'Per month', charged: 'Charged', yearly: 'Yearly set-aside',
    none: '—',
  },
  line: { left: (a) => `${a} left`, over: (a) => `${a} over`, ofCap: (a) => `of ${a}`, dueOn: (d) => `Due on the ${d}` },
  extra: {
    payoffOrder: 'Payoff order',
    firstDebt: (n) => `${n} is cleared first`,
    nextCharge: (n, d) => `Next: ${n}, ${d}`,
    chargesLeft: (n) => (n === 1 ? '1 charge left this month' : `${n} charges left this month`),
    allCharged: 'Every subscription has been charged',
    safetyCovers: (m, t) => `${m} of ${t} months of essentials`,
    goalPercent: (p) => `${p}%`,
    zakat: 'Zakat is set aside with each payday so it is ready when it falls due.',
    whereItWent: 'Where it went',
  },
  buddgy: { everydayOver: (n, a) => `${n} is ${a} over its limit. Raise the limit or cap the spending.` },
  review: {
    looksRight: 'Looks right',
    checked: 'Checked',
    estimatedNote: 'Some amounts here are estimates. Check them, then confirm.',
    reopen: 'Check again',
    checkFlagged: (n) => `Check ${n} flagged`,
    activate: 'Activate plan',
    blockedFlagged: 'Check the flagged segments first.',
    blockedOver: 'The plan is over your income. Fix it before activating.',
    headline: {
      check: (n) => `${n} to check before you activate`,
      ready: 'Ready to activate',
      over: (a) => `Over income by ${a} · fix before activating`,
    },
    fact: { by: (m) => `Debt-free by ${m}`, around: (m) => `Debt-free around ${m}`, unknown: 'No debt-free date yet' },
    askBuddgy: 'Ask Buddgy to change',
  },
  build: {
    useMyData: 'Use my data',
    useMyDataSub: 'Start from what Buddgy found in your accounts, then change anything.',
    startBlank: 'Start empty',
    plannedSoFar: 'Planned so far',
    startHere: 'Start here',
    emptyRow: 'Empty · tap to add',
    skip: 'Skip this segment',
    skipped: 'Skipped',
    undoSkip: 'Add it after all',
    done: 'Done',
    doneNext: (s) => `Done · next empty: ${s}`,
    finish: 'Finish and review',
    saveAndAdd: 'Save and add another',
  },
}

export const budgetSegmentCopyAr: BudgetSegmentCopy = {
  back: 'الميزانية',
  empty: 'لا شيء هنا بعد. أضف أول بند.',
  add: (s) => `أضف إلى ${s}`,
  hero: {
    left: 'المتبقي',
    planned: 'المخطط',
    ofPlanned: (a) => `من ${a} مخطط`,
    share: (p) => `${p} من الدخل`,
    perDayToSpend: (a) => `${a} في اليوم للإنفاق`,
  },
  stat: {
    spent: 'المصروف', perDay: 'في اليوم', vsPace: 'مقابل الوتيرة', lines: 'البنود', share: 'من الدخل', planned: 'المخطط',
    paid: 'المدفوع', nextDue: 'الاستحقاق التالي', left: 'المتبقي',
    totalOwed: 'إجمالي المستحق', debtFree: 'الخلو من الديون', minimums: 'الحد الأدنى',
    monthsHeld: 'أشهر محفوظة', target: 'الهدف', reachedBy: 'يتحقق في',
    saved: 'المدّخر', targets: 'المستهدف', perMonth: 'شهريًا',
    perMonthSubs: 'شهريًا', charged: 'المخصوم', yearly: 'ادخار سنوي',
    none: '—',
  },
  line: { left: (a) => `${a} متبقي`, over: (a) => `${a} زيادة`, ofCap: (a) => `من ${a}`, dueOn: (d) => `يستحق يوم ${d}` },
  extra: {
    payoffOrder: 'ترتيب السداد',
    firstDebt: (n) => `${n} يُسدَّد أولًا`,
    nextCharge: (n, d) => `التالي: ${n}، ${d}`,
    chargesLeft: (n) => (n === 1 ? 'خصم واحد متبقٍ هذا الشهر' : n === 2 ? 'خصمان متبقيان هذا الشهر' : `${n} خصومات متبقية هذا الشهر`),
    allCharged: 'تم خصم كل الاشتراكات',
    safetyCovers: (m, t) => `${m} من ${t} أشهر من الضروريات`,
    goalPercent: (p) => `${p}%`,
    zakat: 'تُحجز الزكاة مع كل راتب لتكون جاهزة عند استحقاقها.',
    whereItWent: 'أين ذهبت',
  },
  buddgy: { everydayOver: (n, a) => `${n} تجاوز حده بمقدار ${a}. ارفع الحد أو قلّل الإنفاق.` },
  review: {
    looksRight: 'يبدو صحيحًا',
    checked: 'تمت المراجعة',
    estimatedNote: 'بعض المبالغ هنا تقديرية. راجعها ثم أكّد.',
    reopen: 'راجع مجددًا',
    checkFlagged: (n) => (n === 1 ? 'راجع قسمًا واحدًا' : n === 2 ? 'راجع قسمين' : `راجع ${n} أقسام`),
    activate: 'فعّل الخطة',
    blockedFlagged: 'راجع الأقسام المعلَّمة أولًا.',
    blockedOver: 'الخطة أعلى من دخلك. عالجها قبل التفعيل.',
    headline: {
      check: (n) => (n === 1 ? 'قسم واحد للمراجعة قبل التفعيل' : n === 2 ? 'قسمان للمراجعة قبل التفعيل' : `${n} أقسام للمراجعة قبل التفعيل`),
      ready: 'جاهزة للتفعيل',
      over: (a) => `أعلى من الدخل بمقدار ${a} · عالجها قبل التفعيل`,
    },
    fact: { by: (m) => `خالٍ من الديون بحلول ${m}`, around: (m) => `خالٍ من الديون نحو ${m}`, unknown: 'لا موعد للخلو من الديون بعد' },
    askBuddgy: 'اطلب من بادجي التعديل',
  },
  build: {
    useMyData: 'استخدم بياناتي',
    useMyDataSub: 'ابدأ مما وجده بادجي في حساباتك، ثم عدّل ما تشاء.',
    startBlank: 'ابدأ فارغًا',
    plannedSoFar: 'المخطط حتى الآن',
    startHere: 'ابدأ من هنا',
    emptyRow: 'فارغ · اضغط للإضافة',
    skip: 'تخطَّ هذا القسم',
    skipped: 'تم التخطي',
    undoSkip: 'أضفه رغم ذلك',
    done: 'تم',
    doneNext: (s) => `تم · التالي الفارغ: ${s}`,
    finish: 'أنهِ وراجع',
    saveAndAdd: 'احفظ وأضف آخر',
  },
}
