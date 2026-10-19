import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import type { SubscriptionBillingCycle, SubscriptionTracking } from '@/lib/store/types'

interface SubLabels {
  name: string
  amount: string
  cycle: string
  cycles: Record<SubscriptionBillingCycle, string>
  firstCharge: string
  trialEnds: string
  plan: string
  category: string
  method: string
  tracking: string
  trackings: Record<SubscriptionTracking, string>
  billingDay: string
  notes: string
  nextCharge: string
  endsOn: string
  oldPrice: string
  newPrice: string
  addSub: string
  changeSub: string
  pauseSub: string
  resumeSub: string
  resubscribeSub: string
  cancelSub: string
  markPaid: string
  adoptPrice: string
  deleteSub: string
  duplicate: string
  trialEffect: string
  impact: (monthly: string, after: string) => string
  pauseEffect: string
  resumeEffect: string
  resubscribeEffect: string
  cancelEffect: (name: string) => string
  howTo: string
  markPaidEffect: string
  adoptEffect: string
  deleteEffect: (charges: number) => string
  statuses: Record<'active' | 'trial' | 'paused' | 'cancelled' | 'ended', string>
  status: string
}

const EN: SubLabels = {
  name: 'Service',
  amount: 'Price',
  cycle: 'Billed',
  cycles: { monthly: 'Monthly', quarterly: 'Every 3 months', semiannual: 'Every 6 months', yearly: 'Yearly', weekly: 'Weekly' },
  firstCharge: 'First charge',
  trialEnds: 'Trial ends',
  plan: 'Plan',
  category: 'Category',
  method: 'Paid with',
  tracking: 'Recorded by',
  trackings: { sms: 'Bank SMS', ask: 'Asking you', log: 'Automatically' },
  billingDay: 'Billing day',
  notes: 'Notes',
  nextCharge: 'Charge date',
  endsOn: 'Access until',
  oldPrice: 'Current price',
  newPrice: 'New price',
  addSub: 'Add subscription',
  changeSub: 'Change subscription',
  pauseSub: 'Pause subscription',
  resumeSub: 'Resume subscription',
  resubscribeSub: 'Re-subscribe',
  cancelSub: 'Cancel subscription',
  markPaid: 'Mark as paid',
  adoptPrice: 'Adopt new price',
  deleteSub: 'Delete subscription',
  duplicate: 'You already track a subscription with this name.',
  trialEffect: 'Free until the trial ends; nothing is charged before then.',
  impact: (m, a) => `Adds ${m} a month. Committed becomes ${a}.`,
  pauseEffect: 'No charges are expected while it is paused.',
  resumeEffect: 'Charges are expected again.',
  resubscribeEffect: 'It becomes active and charges are expected again.',
  cancelEffect: (n) => `This only stops tracking. You still need to cancel with ${n} yourself.`,
  howTo: 'How to cancel',
  markPaidEffect: 'Adds a subscription expense for this cycle.',
  adoptEffect: 'The old price stays in the price history.',
  deleteEffect: (c) => `Its planned recurring expense is removed.${c > 0 ? ` ${c} recorded charge${c === 1 ? '' : 's'} stay in your spending.` : ''}`,
  statuses: { active: 'Active', trial: 'Trial', paused: 'Paused', cancelled: 'Cancelled', ended: 'Ended' },
  status: 'Status',
}

const AR: SubLabels = {
  name: 'الخدمة',
  amount: 'السعر',
  cycle: 'دورة الدفع',
  cycles: { monthly: 'شهري', quarterly: 'كل 3 شهور', semiannual: 'كل 6 شهور', yearly: 'سنوي', weekly: 'أسبوعي' },
  firstCharge: 'أول خصم',
  trialEnds: 'تنتهي التجربة',
  plan: 'الباقة',
  category: 'الفئة',
  method: 'طريقة الدفع',
  tracking: 'طريقة التسجيل',
  trackings: { sms: 'رسائل البنك', ask: 'نسألك', log: 'تلقائيًا' },
  billingDay: 'يوم الخصم',
  notes: 'ملاحظات',
  nextCharge: 'تاريخ الخصم',
  endsOn: 'الاشتراك ساري حتى',
  oldPrice: 'السعر الحالي',
  newPrice: 'السعر الجديد',
  addSub: 'إضافة اشتراك',
  changeSub: 'تعديل اشتراك',
  pauseSub: 'إيقاف الاشتراك مؤقتًا',
  resumeSub: 'استئناف الاشتراك',
  resubscribeSub: 'إعادة الاشتراك',
  cancelSub: 'إلغاء الاشتراك',
  markPaid: 'تسجيل كمدفوع',
  adoptPrice: 'اعتماد السعر الجديد',
  deleteSub: 'حذف الاشتراك',
  duplicate: 'عندك اشتراك بنفس الاسم بالفعل.',
  trialEffect: 'مجاني حتى تنتهي التجربة ولا يُخصم شيء قبل ذلك.',
  impact: (m, a) => `يضيف ${m} شهريًا. تصبح الالتزامات ${a}.`,
  pauseEffect: 'لا تُتوقع أي خصومات أثناء الإيقاف.',
  resumeEffect: 'تُتوقع الخصومات من جديد.',
  resubscribeEffect: 'يصبح الاشتراك نشطًا وتُتوقع الخصومات من جديد.',
  cancelEffect: (n) => `هذا يوقف التتبع فقط. لازم تلغي الاشتراك بنفسك من ${n}.`,
  howTo: 'طريقة الإلغاء',
  markPaidEffect: 'يضيف مصروف اشتراك لهذه الدورة.',
  adoptEffect: 'يبقى السعر القديم في سجل الأسعار.',
  deleteEffect: (c) => `يُحذف مصروفه المتكرر المخطط.${c > 0 ? ` يبقى ${c} من الخصومات المسجلة في مصروفاتك.` : ''}`,
  statuses: { active: 'نشط', trial: 'تجربة', paused: 'متوقف', cancelled: 'ملغي', ended: 'منتهي' },
  status: 'الحالة',
}

export const subLabels = (locale: BuddgyLocale): SubLabels => (locale === 'ar' ? AR : EN)
