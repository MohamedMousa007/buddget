import type { BuddgyLocale } from '@/lib/buddgy/protocol'

interface DebtLabels {
  name: string
  person: string
  direction: string
  iOwe: string
  theyOwe: string
  amount: string
  currency: string
  kind: string
  kinds: Record<'personal' | 'installment' | 'credit_card' | 'general', string>
  remaining: string
  paid: string
  date: string
  method: string
  notes: string
  item: string
  total: string
  count: string
  perInstallment: string
  frequency: string
  frequencies: Record<'weekly' | 'monthly' | 'quarterly' | 'annually', string>
  startDate: string
  provider: string
  linkedCard: string
  limit: string
  dueDay: string
  graceDays: string
  minPercent: string
  outstanding: string
  last4: string
  karat: string
  relationship: string
  addDebt: string
  addInstallment: string
  addCard: string
  payDebt: string
  changeDebt: string
  clearDebt: string
  deleteDebt: string
  deletePayment: string
  duplicate: string
  clearEffect: (remaining: string) => string
  deleteEffect: (payments: number, schedules: number, expenses: number, plans: number) => string
  goalRemoved: (names: string) => string
  paymentExpenseStays: string
  paymentReturnsToSavings: string
  reopens: string
  willClear: string
  noExpense: string
  gold: (karat: number) => string
}

const EN: DebtLabels = {
  name: 'Name',
  person: 'Person',
  direction: 'Direction',
  iOwe: 'You owe',
  theyOwe: 'They owe you',
  amount: 'Amount',
  currency: 'Currency',
  kind: 'Type',
  kinds: { personal: 'Personal debt', general: 'Debt', installment: 'Installment plan', credit_card: 'Credit card' },
  remaining: 'Remaining',
  paid: 'Paid so far',
  date: 'Date',
  method: 'Paid with',
  notes: 'Notes',
  item: 'Item',
  total: 'Total',
  count: 'Installments',
  perInstallment: 'Each installment',
  frequency: 'Frequency',
  frequencies: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Yearly' },
  startDate: 'First payment',
  provider: 'Provider',
  linkedCard: 'Credit card',
  limit: 'Credit limit',
  dueDay: 'Payment due day',
  graceDays: 'Grace days',
  minPercent: 'Minimum payment %',
  outstanding: 'Current balance',
  last4: 'Last 4 digits',
  karat: 'Gold karat',
  relationship: 'Relationship',
  addDebt: 'Add debt',
  addInstallment: 'Add installment plan',
  addCard: 'Add credit card',
  payDebt: 'Record debt payment',
  changeDebt: 'Change debt',
  clearDebt: 'Mark debt as cleared',
  deleteDebt: 'Delete debt',
  deletePayment: 'Delete debt payment',
  duplicate: 'Looks like a debt you already have.',
  clearEffect: (r) => `${r} stays unpaid and the debt moves to cleared.`,
  deleteEffect: (p, s, e, plans) =>
    [
      `${p} payment record${p === 1 ? '' : 's'} and ${s} payment reminder${s === 1 ? '' : 's'} will be deleted.`,
      e > 0 ? `${e} payment expense${e === 1 ? '' : 's'} stay in your spending.` : '',
      plans > 0 ? `${plans} installment plan${plans === 1 ? '' : 's'} on this card will lose the link.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  goalRemoved: (n) => `Debt-free goal removed: ${n}.`,
  paymentExpenseStays: 'The spending entry for this payment stays.',
  paymentReturnsToSavings: 'The money goes back to the savings pocket it came from.',
  reopens: 'The debt becomes active again.',
  willClear: 'This payment clears the debt.',
  noExpense: 'Recorded as a repayment, not as spending.',
  gold: (k) => `${k}K gold`,
}

const AR: DebtLabels = {
  name: 'الاسم',
  person: 'الشخص',
  direction: 'الاتجاه',
  iOwe: 'عليك',
  theyOwe: 'لك',
  amount: 'المبلغ',
  currency: 'العملة',
  kind: 'النوع',
  kinds: { personal: 'دين شخصي', general: 'دين', installment: 'خطة تقسيط', credit_card: 'بطاقة ائتمان' },
  remaining: 'المتبقي',
  paid: 'المسدد',
  date: 'التاريخ',
  method: 'طريقة الدفع',
  notes: 'ملاحظات',
  item: 'السلعة',
  total: 'الإجمالي',
  count: 'عدد الأقساط',
  perInstallment: 'قيمة القسط',
  frequency: 'التكرار',
  frequencies: { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربع سنوي', annually: 'سنوي' },
  startDate: 'أول قسط',
  provider: 'الجهة',
  linkedCard: 'بطاقة الائتمان',
  limit: 'حد الائتمان',
  dueDay: 'يوم السداد',
  graceDays: 'أيام السماح',
  minPercent: 'نسبة الحد الأدنى',
  outstanding: 'الرصيد الحالي',
  last4: 'آخر 4 أرقام',
  karat: 'عيار الذهب',
  relationship: 'صلة القرابة',
  addDebt: 'إضافة دين',
  addInstallment: 'إضافة خطة تقسيط',
  addCard: 'إضافة بطاقة ائتمان',
  payDebt: 'تسجيل سداد دين',
  changeDebt: 'تعديل دين',
  clearDebt: 'تحديد الدين كمسدد',
  deleteDebt: 'حذف دين',
  deletePayment: 'حذف دفعة دين',
  duplicate: 'يبدو أن عندك دينًا مطابقًا.',
  clearEffect: (r) => `يبقى ${r} غير مسدد وينتقل الدين إلى المسددة.`,
  deleteEffect: (p, s, e, plans) =>
    [
      `سيتم حذف ${p} من سجلات السداد و${s} من التذكيرات.`,
      e > 0 ? `يبقى ${e} من المصروفات المرتبطة بالسداد في مصروفاتك.` : '',
      plans > 0 ? `${plans} من خطط التقسيط على هذه البطاقة ستفقد الربط.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  goalRemoved: (n) => `سيُحذف هدف التحرر من الدين: ${n}.`,
  paymentExpenseStays: 'يبقى المصروف المرتبط بهذه الدفعة كما هو.',
  paymentReturnsToSavings: 'يعود المبلغ إلى حصّالة الادخار التي خرج منها.',
  reopens: 'يعود الدين نشطًا من جديد.',
  willClear: 'هذه الدفعة تسدد الدين بالكامل.',
  noExpense: 'تُسجَّل كسداد وليس كمصروف.',
  gold: (k) => `ذهب عيار ${k}`,
}

export const debtLabels = (locale: BuddgyLocale): DebtLabels => (locale === 'ar' ? AR : EN)
