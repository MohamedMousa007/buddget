import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import { AR_UNITS, arPlural } from '@/lib/i18n/arPlural'

/** "salary" for a salary source, "income" for every other (round 9: Salary only for salary sources). */
export type IncomeNoun = 'salary' | 'income'

/** Income (was Paydays, final-ui v9 `lt-v8-income.js`): the home list, a source page, its history and menu. */
export interface PaydaysLtCopy {
  eachMonth: (cur: string) => string
  eachPayday: (cur: string) => string
  onTime: string
  ofN: (n: number, of: number) => string
  history: string
  rowTitle: (type: string, month: string) => string
  onTimeSub: (date: string) => string
  lateSub: (date: string, n: number) => string
  partialSub: (date: string, got: string, of: string) => string
  missedSub: (date: string) => string
  openSub: (date: string) => string
  expected: string
  receivedIn: string
  noAccount: string
  sources: string
  addPayday: string
  payCycle: string
  /** The quiet row at the end of the page that opens pay cycle and reorder. */
  more: string
  monthCircle: (month: string, state: string) => string
  states: { received: string; late: string; partial: string; missed: string }
  home: {
    label: (month: string) => string
    received: (cur: string) => string
    sourcesIn: (n: number, of: number) => string
    toCome: (amount: string) => string
    allIn: string
    nextOn: (name: string, date: string) => string
    head: string
    add: string
    statusReceived: string
    statusDue: (date: string) => string
    cadence: Record<'monthly' | 'biweekly' | 'weekly', string>
    cadenceNext: (cadence: string, date: string) => string
    emptyTitle: string
    emptyBody: string
  }
  source: {
    back: string
    nextLine: (noun: IncomeNoun, date: string, days: number) => string
    dueTitle: (month: string, noun: IncomeNoun, date: string) => string
    dueBody: string
    confirm: string
    details: string
    amount: string
    howOften: string
    paidInto: string
    more: string
    edit: (noun: IncomeNoun) => string
    logPast: (noun: IncomeNoun) => string
    delete: (noun: IncomeNoun) => string
    deleteTitle: (noun: IncomeNoun) => string
    deleteBody: string
  }
  /** The Assign sheet's one empty tile and Flow's swipe action. */
  assign: { title: string; body: string; bodyFrom: string; addSalary: string; addSalarySub: string; swipe: string; rowHint: string; rowBadge: string; cta: (name: string) => string }
  /** Add income source (the Add goal C top, then how often, the day, the account). */
  form: { arrivesOn: string; howOften: string; eachSalary: string; eachTime: string; nameAria: string }
  /** The money-in sheet (round 8 Assign card, round 9 short tip). */
  moneyIn: { assignedTo: string; notAssigned: string; tipTitle: string; tip: string; cta: string; save: string }
}

const EN_NOUN: Record<IncomeNoun, string> = { salary: 'salary', income: 'income' }
const AR_NOUN: Record<IncomeNoun, string> = { salary: 'الراتب', income: 'الدخل' }

export const PAYDAYS_LT_COPY: Record<Locale, PaydaysLtCopy> = {
  en: {
    eachMonth: (cur) => `${cur} each month`,
    eachPayday: (cur) => `${cur} each time`,
    onTime: 'On time',
    ofN: (n, of) => `${n} of ${of}`,
    history: 'History',
    rowTitle: (type, month) => `${type} · ${month}`,
    onTimeSub: (d) => `${d} · on time`,
    lateSub: (d, n) => (n === 1 ? `${d} · 1 day late` : `${d} · ${n} days late`),
    partialSub: (d, got, of) => `${d} · ${got} of ${of}`,
    missedSub: (d) => `${d} · missed`,
    openSub: (d) => `Due ${d} · not logged yet`,
    expected: 'expected',
    receivedIn: 'Received in',
    noAccount: 'Received in: not set',
    sources: 'Income',
    addPayday: 'Add income',
    payCycle: 'Pay cycle',
    more: 'Pay cycle and order',
    monthCircle: (m, s) => `${m}: ${s}`,
    states: { received: 'on time', late: 'late', partial: 'partly paid', missed: 'missed' },
    home: {
      label: (m) => `Income · ${m}`,
      received: (cur) => `${cur} received`,
      sourcesIn: (n, of) => `${n} of ${of} sources in`,
      toCome: (a) => `${a} to come`,
      allIn: 'All in',
      nextOn: (n, d) => `Next ${n} on ${d}`,
      head: 'Sources',
      add: 'Add income',
      statusReceived: 'Received',
      statusDue: (d) => `Due ${d}`,
      cadence: { monthly: 'Monthly', biweekly: 'Biweekly', weekly: 'Weekly' },
      cadenceNext: (c, d) => `${c} · next ${d}`,
      emptyTitle: 'Tell buddget when you get paid',
      emptyBody: 'Add your salary, rent or dividends. buddget expects each one, flags a late salary and matches bank SMS to them for you.',
    },
    source: {
      back: 'Income',
      nextLine: (n, d, days) => `Next ${EN_NOUN[n]} ${d} · ${days <= 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`}`,
      dueTitle: (m, n, d) => `${m} ${EN_NOUN[n]} · due ${d}`,
      dueBody: 'Tell buddget when it arrives',
      confirm: 'Confirm received',
      details: 'Details',
      amount: 'Amount',
      howOften: 'How often',
      paidInto: 'Paid into',
      more: 'More actions',
      edit: (n) => `Edit ${EN_NOUN[n]}`,
      logPast: (n) => `Log a past ${EN_NOUN[n]}`,
      delete: (n) => `Delete ${EN_NOUN[n]}`,
      deleteTitle: (n) => `Delete this ${EN_NOUN[n]}?`,
      deleteBody: 'What already arrived stays in Flow as one-time income.',
    },
    assign: {
      title: 'Which income is this?',
      body: '{amount} {currency} arrived on {date}. Assigning keeps that date and links it to a salary or income you get regularly.',
      bodyFrom: '{amount} {currency} from {from} arrived on {date}. Assigning keeps that date and links it to a salary or income you get regularly.',
      addSalary: 'Add salary', addSalarySub: 'Create a new salary and assign this to it', swipe: 'Assign', rowHint: 'swipe to assign', rowBadge: 'Not assigned', cta: (n) => `Assign to ${n}` },
    form: { arrivesOn: 'Arrives on', howOften: 'How often', eachSalary: 'Each salary', eachTime: 'Each time it arrives', nameAria: 'Name' },
    moneyIn: {
      assignedTo: 'Assigned to',
      notAssigned: 'Not assigned',
      tipTitle: 'One-time, or part of a salary?',
      tip: 'Assign links this money to a salary or income you get regularly.',
      cta: 'Assign to a salary',
      save: 'Save changes',
    },
  },
  ar: {
    eachMonth: (cur) => `${cur} كل شهر`,
    eachPayday: (cur) => `${cur} كل مرة`,
    onTime: 'في موعده',
    ofN: (n, of) => `${n} من ${of}`,
    history: 'السجل',
    rowTitle: (type, month) => `${type} · ${month}`,
    onTimeSub: (d) => `${d} · في موعده`,
    lateSub: (d, n) => (n === 1 ? `${d} · متأخر يومًا` : n === 2 ? `${d} · متأخر يومين` : `${d} · متأخر ${n} أيام`),
    partialSub: (d, got, of) => `${d} · ${got} من ${of}`,
    missedSub: (d) => `${d} · لم يصل`,
    openSub: (d) => `مستحق ${d} · لم يُسجَّل بعد`,
    expected: 'متوقع',
    receivedIn: 'يصل إلى',
    noAccount: 'يصل إلى: غير محدد',
    sources: 'الدخل',
    addPayday: 'أضف دخلًا',
    payCycle: 'دورة الراتب',
    more: 'دورة الراتب والترتيب',
    monthCircle: (m, s) => `${m}: ${s}`,
    states: { received: 'في موعده', late: 'متأخر', partial: 'مدفوع جزئيًا', missed: 'لم يصل' },
    home: {
      label: (m) => `الدخل · ${m}`,
      received: (cur) => `${cur} وصلت`,
      sourcesIn: (n, of) => `${n} من ${of} مصادر وصلت`,
      toCome: (a) => `${a} باقية`,
      allIn: 'وصل كله',
      nextOn: (n, d) => `القادم ${n} في ${d}`,
      head: 'المصادر',
      add: 'أضف دخلًا',
      statusReceived: 'وصل',
      statusDue: (d) => `مستحق ${d}`,
      cadence: { monthly: 'شهري', biweekly: 'كل أسبوعين', weekly: 'أسبوعي' },
      cadenceNext: (c, d) => `${c} · القادم ${d}`,
      emptyTitle: 'أخبر بادجت متى تقبض',
      emptyBody: 'أضف راتبك أو الإيجار أو الأرباح. يتوقع بادجت كل دخل وينبهك لتأخر الراتب ويطابق رسائل البنك معه.',
    },
    source: {
      back: 'الدخل',
      nextLine: (n, d, days) => `${AR_NOUN[n]} القادم ${d} · ${days <= 0 ? 'اليوم' : `بعد ${arPlural(days, AR_UNITS.day)}`}`,
      dueTitle: (m, n, d) => `${AR_NOUN[n]} ${m} · مستحق ${d}`,
      dueBody: 'أخبر بادجت عندما يصل',
      confirm: 'تأكيد الوصول',
      details: 'التفاصيل',
      amount: 'المبلغ',
      howOften: 'التكرار',
      paidInto: 'يصل إلى',
      more: 'إجراءات أخرى',
      edit: (n) => `تعديل ${AR_NOUN[n]}`,
      logPast: (n) => `تسجيل ${AR_NOUN[n]} سابق`,
      delete: (n) => `حذف ${AR_NOUN[n]}`,
      deleteTitle: (n) => `حذف ${n === 'salary' ? 'هذا الراتب' : 'هذا الدخل'}؟`,
      deleteBody: 'ما وصل بالفعل يبقى في التدفق كدخل لمرة واحدة.',
    },
    assign: {
      title: 'أي دخل هذا؟',
      body: 'وصل {amount} {currency} في {date}. الربط يحتفظ بهذا التاريخ ويضمه إلى راتب أو دخل يصلك بانتظام.',
      bodyFrom: 'وصل {amount} {currency} من {from} في {date}. الربط يحتفظ بهذا التاريخ ويضمه إلى راتب أو دخل يصلك بانتظام.',
      addSalary: 'أضف راتبًا', addSalarySub: 'أنشئ راتبًا جديدًا واربط هذا المبلغ به', swipe: 'ربط', rowHint: 'اسحب للربط', rowBadge: 'غير مرتبط', cta: (n) => `اربطه بـ${n}` },
    form: { arrivesOn: 'يصل يوم', howOften: 'التكرار', eachSalary: 'كل راتب', eachTime: 'كل مرة يصل', nameAria: 'الاسم' },
    moneyIn: {
      assignedTo: 'مرتبط بـ',
      notAssigned: 'غير مرتبط',
      tipTitle: 'لمرة واحدة، أم جزء من راتب؟',
      tip: 'الربط يضم هذا المبلغ إلى راتب أو دخل يصلك بانتظام.',
      cta: 'اربطه براتب',
      save: 'حفظ التغييرات',
    },
  },
}

export function usePaydaysLtCopy(): PaydaysLtCopy {
  return PAYDAYS_LT_COPY[useLocale().locale]
}
