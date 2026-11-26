import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { arPlural } from '@/lib/i18n/arPlural'

const AR_TX = { one: 'معاملة', two: 'معاملتين', few: 'معاملات', many: 'معاملة' }
const AR_ITEM = { one: 'صنف', two: 'صنفين', few: 'أصناف', many: 'صنفًا' }

/** Light touch Flow (A1): the page, filters, expense and income sheets, receipt viewer and held bank messages. */
export interface FlowLtCopy {
  page: {
    heroIn: string
    heroOut: string
    /** Scale middle: "8,247 left". */
    left: (x: string) => string
    /** Month header count: "13 transactions". */
    monthCount: (n: number) => string
    results: (n: number) => string
    emptyTitle: (month: string) => string
    emptyBody: string
    addAnExpense: string
    noMatchBody: string
  }
  filters: {
    title: string
    dateRange: string
    amountRange: string
    category: string
    paidWith: string
    allTime: string
    lastMonth: string
    pctOfBudget: (pct: number) => string
    noBudget: string
    allMethods: string
    allMethodsSub: string
    nSelected: (n: number) => string
    paidPickSub: string
  }
  expense: {
    budgetLeft: (cat: string, left: string) => string
    budgetOver: (cat: string, over: string) => string
    /** An expense outside the current month: which budget it counted in, without this month's figure. */
    counted: (cat: string) => string
    noBudget: (cat: string) => string
    notCounted: string
    moneyMove: string
    recordedFrom: string
    fromSms: (bank: string) => string
    fromSmsPlain: string
    fromReceipt: string
    fromYou: string
    deleteAria: string
    deleteTitle: string
    deleteBody: (title: string) => string
    keepEditing: string
    /** Leaving a new expense that has something typed into it. */
    unsavedAddBody: string
    /** The time row in the date card. */
    time: string
    catPickSub: string
    catLeft: (x: string) => string
    catOver: (x: string) => string
    receiptItems: (n: number) => string
    more: (n: number) => string
    viewImage: string
    allItems: (n: number) => string
  }
  receipt: {
    title: string
    sub: string
    scanned: (d: string) => string
    paidWith: string
    total: string
    viewReceiptImage: string
    items: (n: number) => string
    subtotal: string
    note: (cat: string) => string
    imageTitle: (merchant: string) => string
    imageSub: (d: string) => string
    showAtStore: string
    close: string
  }
  income: {
    type: string
    receivedIn: string
    payday: string
    notLinked: string
    lineOnTime: (month: string) => string
    lineLate: (month: string, days: number) => string
    lineOneTime: string
    linePassThrough: string
    deleteAria: string
    typePickTitle: string
    unsavedBody: string
  }
  held: {
    title: string
    sub: string
    swipeTip: string
    addThese: (n: number) => string
    remove: (title: string) => string
    add: (title: string) => string
    /** The question on an outgoing transfer the bank message alone can't settle. */
    transferAsk: string
    yesTransfer: string
    noSpending: string
  }
}

export const FLOW_LT_COPY: Record<Locale, FlowLtCopy> = {
  en: {
    page: {
      heroIn: 'in',
      heroOut: 'out',
      left: (x) => `${x} left`,
      monthCount: (n) => (n === 1 ? '1 transaction' : `${n} transactions`),
      results: (n) => (n === 1 ? '1 result' : `${n} results`),
      emptyTitle: (m) => `Nothing in ${m} yet`,
      emptyBody: 'Add one with +, or let your bank texts do it for you.',
      addAnExpense: 'Add an expense',
      noMatchBody: 'Try a wider date range or fewer categories.',
    },
    filters: {
      title: 'Filters',
      dateRange: 'Date range',
      amountRange: 'Amount range',
      category: 'Category',
      paidWith: 'Paid with',
      allTime: 'All time',
      lastMonth: 'Last month',
      pctOfBudget: (p) => `${p}% of budget`,
      noBudget: 'No budget',
      allMethods: 'All cards and accounts',
      allMethodsSub: 'Tap to choose cards, banks or wallets',
      nSelected: (n) => `${n} selected`,
      paidPickSub: 'Pick one or more',
    },
    expense: {
      budgetLeft: (c, x) => `Counted in your ${c} budget · ${x} left`,
      budgetOver: (c, x) => `Counted in your ${c} budget · ${x} over`,
      counted: (c) => `Counted in your ${c} budget`,
      noBudget: (c) => `${c} has no budget this month`,
      notCounted: 'Not counted in your spending',
      moneyMove: 'Money moving between your accounts',
      recordedFrom: 'Recorded from',
      fromSms: (b) => `Bank SMS · ${b}`,
      fromSmsPlain: 'Bank SMS',
      fromReceipt: 'Scanned receipt',
      fromYou: 'Added by you',
      deleteAria: 'Delete expense',
      deleteTitle: 'Delete this expense?',
      deleteBody: (t) => `${t} leaves your spending and the account balance. You can undo right after.`,
      keepEditing: 'Keep editing',
      unsavedAddBody: 'This expense isn’t saved yet. Save it, or discard it.',
      time: 'Time',
      catPickSub: 'Budget left this month under each one',
      catLeft: (x) => `${x} left`,
      catOver: (x) => `${x} over`,
      receiptItems: (n) => (n === 1 ? 'Receipt · 1 item' : `Receipt · ${n} items`),
      more: (n) => `+${n} more`,
      viewImage: 'View image',
      allItems: (n) => `All ${n} items`,
    },
    receipt: {
      title: 'Receipt',
      sub: 'Read from your scan',
      scanned: (d) => `Scanned ${d}`,
      paidWith: 'Paid with',
      total: 'Total',
      viewReceiptImage: 'View receipt image',
      items: (n) => (n === 1 ? '1 item' : `${n} items`),
      subtotal: 'Subtotal',
      note: (c) => `One expense for the whole receipt, counted in ${c}. The image is cropped and enhanced so it can be shown at the store for an exchange or refund.`,
      imageTitle: (m) => `${m} receipt`,
      imageSub: (d) => `Cropped and enhanced · ${d}`,
      showAtStore: 'Show this at the store for an exchange or a refund.',
      close: 'Close image',
    },
    income: {
      type: 'Type',
      receivedIn: 'Received in',
      payday: 'Payday',
      notLinked: 'Not linked',
      lineOnTime: (m) => `Your ${m} payday · on time`,
      lineLate: (m, n) => (n === 1 ? `Your ${m} payday · 1 day late` : `Your ${m} payday · ${n} days late`),
      lineOneTime: 'One-time money in',
      linePassThrough: 'Passed through you · not counted as income',
      deleteAria: 'Delete income',
      typePickTitle: 'Income type',
      unsavedBody: 'You’ve edited this income. Save your changes, or discard them and keep the original.',
    },
    held: {
      title: 'Bank messages',
      sub: 'Tick the ones that look right',
      swipeTip: 'Swipe a message left to remove it',
      addThese: (n) => (n === 1 ? 'Add 1' : `Add these ${n}`),
      remove: (t) => `Remove ${t}`,
      add: (t) => `Add ${t}`,
      transferAsk: 'Was this really a transfer?',
      yesTransfer: 'Yes, a transfer',
      noSpending: 'No, spending',
    },
  },
  ar: {
    page: {
      heroIn: 'دخل',
      heroOut: 'خرج',
      left: (x) => `متبقي ${x}`,
      monthCount: (n) => arPlural(n, AR_TX),
      results: (n) => arPlural(n, { one: 'نتيجة', two: 'نتيجتين', few: 'نتائج', many: 'نتيجة', fem: true }),
      emptyTitle: (m) => `لا شيء في ${m} بعد`,
      emptyBody: 'أضف واحدة من +، أو دع رسائل البنك تفعل ذلك عنك.',
      addAnExpense: 'أضف مصروفًا',
      noMatchBody: 'جرّب فترة أوسع أو فئات أقل.',
    },
    filters: {
      title: 'الفلاتر',
      dateRange: 'الفترة',
      amountRange: 'نطاق المبلغ',
      category: 'الفئة',
      paidWith: 'الدفع بـ',
      allTime: 'كل الوقت',
      lastMonth: 'الشهر الماضي',
      pctOfBudget: (p) => `${p}% من الميزانية`,
      noBudget: 'بلا ميزانية',
      allMethods: 'كل البطاقات والحسابات',
      allMethodsSub: 'اضغط لاختيار بطاقات أو بنوك أو محافظ',
      nSelected: (n) => `${n} مختارة`,
      paidPickSub: 'اختر واحدًا أو أكثر',
    },
    expense: {
      budgetLeft: (c, x) => `محسوب في ميزانية ${c} · متبقي ${x}`,
      budgetOver: (c, x) => `محسوب في ميزانية ${c} · تجاوز ${x}`,
      counted: (c) => `محسوب في ميزانية ${c}`,
      noBudget: (c) => `لا ميزانية لـ${c} هذا الشهر`,
      notCounted: 'غير محسوب في إنفاقك',
      moneyMove: 'نقل أموال بين حساباتك',
      recordedFrom: 'سُجّل من',
      fromSms: (b) => `رسالة البنك · ${b}`,
      fromSmsPlain: 'رسالة البنك',
      fromReceipt: 'إيصال ممسوح',
      fromYou: 'أضفته أنت',
      deleteAria: 'احذف المصروف',
      deleteTitle: 'حذف هذا المصروف؟',
      deleteBody: (t) => `يخرج ${t} من إنفاقك ومن رصيد الحساب. يمكنك التراجع بعدها مباشرة.`,
      keepEditing: 'متابعة التعديل',
      unsavedAddBody: 'لم يُحفظ هذا المصروف بعد. احفظه أو تجاهله.',
      time: 'الوقت',
      catPickSub: 'المتبقي من ميزانية هذا الشهر لكل فئة',
      catLeft: (x) => `متبقي ${x}`,
      catOver: (x) => `تجاوز ${x}`,
      receiptItems: (n) => `إيصال · ${arPlural(n, AR_ITEM)}`,
      more: (n) => `+${n} أخرى`,
      viewImage: 'عرض الصورة',
      allItems: (n) => `كل الأصناف (${n})`,
    },
    receipt: {
      title: 'الإيصال',
      sub: 'مقروء من المسح',
      scanned: (d) => `مُسح ${d}`,
      paidWith: 'الدفع بـ',
      total: 'الإجمالي',
      viewReceiptImage: 'عرض صورة الإيصال',
      items: (n) => arPlural(n, AR_ITEM),
      subtotal: 'المجموع الفرعي',
      note: (c) => `مصروف واحد للإيصال كله، محسوب في ${c}. الصورة مقصوصة ومحسّنة لتعرضها في المتجر عند الاستبدال أو الاسترجاع.`,
      imageTitle: (m) => `إيصال ${m}`,
      imageSub: (d) => `مقصوصة ومحسّنة · ${d}`,
      showAtStore: 'اعرضها في المتجر عند الاستبدال أو الاسترجاع.',
      close: 'أغلق الصورة',
    },
    income: {
      type: 'النوع',
      receivedIn: 'استُلم في',
      payday: 'يوم الدفع',
      notLinked: 'غير مربوط',
      lineOnTime: (m) => `يوم دفع ${m} · في موعده`,
      lineLate: (m, n) => `يوم دفع ${m} · تأخر ${arPlural(n, { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا' })}`,
      lineOneTime: 'دخل لمرة واحدة',
      linePassThrough: 'مرّ عبرك · غير محسوب كدخل',
      deleteAria: 'احذف الدخل',
      typePickTitle: 'نوع الدخل',
      unsavedBody: 'عدّلت هذا الدخل. احفظ التغييرات، أو تجاهلها واحتفظ بالأصل.',
    },
    held: {
      title: 'رسائل البنك',
      sub: 'حدّد ما يبدو صحيحًا',
      swipeTip: 'اسحب الرسالة لليسار لإزالتها',
      addThese: (n) => (n === 1 ? 'أضف واحدة' : `أضف هذه الـ${n}`),
      remove: (t) => `أزل ${t}`,
      add: (t) => `أضف ${t}`,
      transferAsk: 'هل كان هذا تحويلًا فعلًا؟',
      yesTransfer: 'نعم، تحويل',
      noSpending: 'لا، إنفاق',
    },
  },
}

export function useFlowLtCopy(): FlowLtCopy {
  const { locale } = useLocale()
  return FLOW_LT_COPY[locale]
}
