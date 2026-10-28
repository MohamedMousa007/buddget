import type { BuddgyLocale } from '@/lib/buddgy/protocol'

/** Short labels for preview cards. Domains add their own keys as they need them. */
const EN = {
  description: 'Description',
  amount: 'Amount',
  category: 'Category',
  method: 'Paid with',
  date: 'Date',
  notes: 'Notes',
  addExpense: 'Add expense',
  changeExpense: 'Change expense',
  deleteExpense: 'Delete expense',
  openScreen: 'Open a screen',
  openTarget: 'Go to',
  navConsentEffect: 'Buddgy will move you to another screen. Asked once per session.',
  duplicateWarning: 'Looks like an expense you just added.',
  debtLinked: 'This expense belongs to a debt payment. Edit it from the debt.',
  receiptLinked: 'This expense is part of a scanned receipt. Edit it from the receipt.',
} as const

type Labels = Record<keyof typeof EN, string>

const AR: Labels = {
  description: 'الوصف',
  amount: 'المبلغ',
  category: 'الفئة',
  method: 'طريقة الدفع',
  date: 'التاريخ',
  notes: 'ملاحظات',
  addExpense: 'إضافة مصروف',
  changeExpense: 'تعديل مصروف',
  deleteExpense: 'حذف مصروف',
  openScreen: 'فتح شاشة',
  openTarget: 'الذهاب إلى',
  navConsentEffect: 'سينقلك بادجي إلى شاشة أخرى. يُسأل مرة واحدة في الجلسة.',
  duplicateWarning: 'يبدو أنه مصروف أضفته للتو.',
  debtLinked: 'هذا المصروف جزء من دفعة دين. عدّله من صفحة الدين.',
  receiptLinked: 'هذا المصروف جزء من إيصال ممسوح. عدّله من الإيصال.',
}

export const labels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)
