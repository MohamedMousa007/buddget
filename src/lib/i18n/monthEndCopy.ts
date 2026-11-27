import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** The Monthly saving row and sheet on Savings (final-ui v9, LOGIC_SPEC §1 glossary). */
export interface MonthEndCopy {
  rowTitle: string
  rowIdle: string
  rowPending: (month: string, date: string) => string
  rowPendingShort: (month: string, short: string, date: string) => string
  rowApplied: (month: string, date: string) => string
  rowOverspent: (month: string, amount: string) => string
  sheetTitle: string
  sheetSubtitle: string
  leftoverTitle: (month: string) => string
  appliesOn: (date: string) => string
  summary: (received: string, spent: string) => string
  alreadySaved: (amount: string) => string
  notPlaced: (amount: string) => string
  hadFree: (account: string, amount: string) => string
  afterCards: string
  whereItGoes: string
  inAccount: (account: string) => string
  amountIn: (amount: string, account: string) => string
  edit: string
  confirm: string
  setAsideTitle: (month: string) => string
  setAsideLine: (amount: string, where: string, date: string) => string
  inAccounts: (n: number) => string
  undo: string
  undoBlocked: string
  undoneTitle: (month: string) => string
  notUndone: (amount: string) => string
  overTitle: (month: string) => string
  overBody: (amount: string) => string
  overNothing: string
  gotIt: string
  splitTitle: string
  splitIntro: string
  split: string
  ofHundred: string
  restGoes: (pct: string) => string
  restRow: string
  aboutIn: (amount: string, month: string) => string
  over100: string
  addTarget: string
  addTargetSub: string
  splitFootnote: string
  saveSplit: string
  splitSaved: string
  less: string
  more: string
  goal: string
  pocket: string
  fixedNote: (goal: string, amount: string) => string
  addAsPct: string
  dismiss: string
  confirmed: string
  undone: string
  failed: string
  conflict: string
}

export const MONTH_END_COPY: Record<Locale, MonthEndCopy> = {
  en: {
    rowTitle: 'Monthly saving',
    rowIdle: 'Where your monthly savings go',
    rowPending: (m, d) => `${m} leftover · confirm by ${d}`,
    rowPendingShort: (m, s, d) => `${m} leftover · ${s} fits nowhere · confirm by ${d}`,
    rowApplied: (m, d) => `${m} leftover set aside · applied ${d}`,
    rowOverspent: (m, a) => `${m}: you spent ${a} more than you received`,
    sheetTitle: 'Monthly saving',
    sheetSubtitle: 'This month’s leftover, and where it goes',
    leftoverTitle: (m) => `${m} leftover`,
    appliesOn: (d) => `Applies by itself on ${d}`,
    summary: (r, s) => `Received ${r} · spent ${s}`,
    alreadySaved: (a) => ` · already saved ${a}`,
    notPlaced: (a) => `${a} saved but not set aside: no account had it free.`,
    hadFree: (acc, a) => `${acc} had ${a} free`,
    afterCards: 'after card bills.',
    whereItGoes: 'Where it goes',
    inAccount: (acc) => `In ${acc}`,
    amountIn: (a, acc) => `${a} in ${acc}`,
    edit: 'Edit',
    confirm: 'Confirm',
    setAsideTitle: (m) => `${m} leftover set aside`,
    setAsideLine: (a, w, d) => `${a} ${w} · applied ${d}`,
    inAccounts: (n) => `in ${n} accounts`,
    undo: 'Undo',
    undoBlocked: 'Undo is off: a shortfall answer used this money.',
    undoneTitle: (m) => `Undone · nothing set aside for ${m}`,
    notUndone: (a) => `${a} not undone (already released)`,
    overTitle: (m) => `${m}: nothing to set aside`,
    overBody: (a) => `You spent and set aside ${a} more than you received`,
    overNothing: 'Nothing was set aside and nothing was released.',
    gotIt: 'Got it',
    splitTitle: 'Where your monthly savings go',
    splitIntro: 'At each month end, what’s left after spending is split like this and set aside in the accounts that hold it.',
    split: 'Split',
    ofHundred: 'of 100%',
    restGoes: (p) => `${p}% rest goes to Monthly savings`,
    restRow: 'Rest → Monthly savings',
    aboutIn: (a, m) => `≈ ${a} in ${m}`,
    over100: 'over 100%',
    addTarget: 'Add a goal or pocket',
    addTargetSub: 'It gets a share of every month end',
    splitFootnote: 'The total can’t go above 100%. Each share is capped at the free money in its account; what fits nowhere is shown above, never invented.',
    saveSplit: 'Save split',
    splitSaved: 'Split saved',
    less: '5% less',
    more: '5% more',
    goal: 'Goal',
    pocket: 'Pocket',
    fixedNote: (g, a) => `${g} used to get ${a} a month; add it here as a %`,
    addAsPct: 'Add',
    dismiss: 'Dismiss',
    confirmed: 'Leftover set aside',
    undone: 'Undone',
    failed: 'Couldn’t do that. Try again.',
    conflict: 'This month end changed. Check it again.',
  },
  ar: {
    rowTitle: 'الادخار الشهري',
    rowIdle: 'وين تروح مدخراتك الشهرية',
    rowPending: (m, d) => `المتبقي من ${m} · أكّده قبل ${d}`,
    rowPendingShort: (m, s, d) => `المتبقي من ${m} · ${s} بلا مكان · أكّده قبل ${d}`,
    rowApplied: (m, d) => `تم تخصيص المتبقي من ${m} · طُبّق ${d}`,
    rowOverspent: (m, a) => `${m}: صرفت ${a} أكثر مما استلمت`,
    sheetTitle: 'الادخار الشهري',
    sheetSubtitle: 'المتبقي من هذا الشهر، وأين يذهب',
    leftoverTitle: (m) => `المتبقي من ${m}`,
    appliesOn: (d) => `يُطبَّق تلقائيًا يوم ${d}`,
    summary: (r, s) => `استلمت ${r} · صرفت ${s}`,
    alreadySaved: (a) => ` · ادّخرت بالفعل ${a}`,
    notPlaced: (a) => `${a} مدّخرة لكن لم تُخصَّص: لا يوجد حساب فيه هذا المبلغ متاحًا.`,
    hadFree: (acc, a) => `في ${acc} ${a} متاح`,
    afterCards: 'بعد فواتير البطاقات.',
    whereItGoes: 'أين يذهب',
    inAccount: (acc) => `في ${acc}`,
    amountIn: (a, acc) => `${a} في ${acc}`,
    edit: 'تعديل',
    confirm: 'تأكيد',
    setAsideTitle: (m) => `تم تخصيص المتبقي من ${m}`,
    setAsideLine: (a, w, d) => `${a} ${w} · طُبّق ${d}`,
    inAccounts: (n) => `في ${n} حسابات`,
    undo: 'تراجع',
    undoBlocked: 'لا يمكن التراجع: استُخدم هذا المبلغ في الرد على نقص.',
    undoneTitle: (m) => `تم التراجع · لم يُخصَّص شيء من ${m}`,
    notUndone: (a) => `${a} لم يُتراجَع عنها (رجعت للمتاح)`,
    overTitle: (m) => `${m}: لا شيء للتخصيص`,
    overBody: (a) => `صرفت وخصّصت ${a} أكثر مما استلمت`,
    overNothing: 'لم يُخصَّص شيء ولم يُرجَع شيء للمتاح.',
    gotIt: 'تمام',
    splitTitle: 'وين تروح مدخراتك الشهرية',
    splitIntro: 'في نهاية كل شهر، يُقسَّم ما يتبقى بعد الصرف بهذه النسب ويُخصَّص في الحسابات التي فيها المال.',
    split: 'التقسيم',
    ofHundred: 'من 100%',
    restGoes: (p) => `الباقي ${p}% يذهب إلى المدخرات الشهرية`,
    restRow: 'الباقي ← المدخرات الشهرية',
    aboutIn: (a, m) => `≈ ${a} في ${m}`,
    over100: 'أكثر من 100%',
    addTarget: 'أضف هدفًا أو جيبًا',
    addTargetSub: 'يأخذ نسبة من نهاية كل شهر',
    splitFootnote: 'لا يمكن أن يتجاوز المجموع 100%. كل نسبة محدودة بالمتاح في حسابها؛ وما لا يجد مكانًا يظهر في الأعلى، ولا يُخترَع.',
    saveSplit: 'حفظ التقسيم',
    splitSaved: 'تم حفظ التقسيم',
    less: 'أقل 5%',
    more: 'أكثر 5%',
    goal: 'هدف',
    pocket: 'جيب',
    fixedNote: (g, a) => `كان ${g} يأخذ ${a} شهريًا؛ أضفه هنا كنسبة`,
    addAsPct: 'إضافة',
    dismiss: 'إخفاء',
    confirmed: 'تم تخصيص المتبقي',
    undone: 'تم التراجع',
    failed: 'تعذّر ذلك. حاول مرة أخرى.',
    conflict: 'تغيّرت نهاية الشهر هذه. راجعها مرة أخرى.',
  },
}

export function useMonthEndCopy(): MonthEndCopy {
  const { locale } = useLocale()
  return MONTH_END_COPY[locale]
}
