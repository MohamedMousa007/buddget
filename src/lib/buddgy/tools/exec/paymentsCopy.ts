import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import type { PaymentMethodType } from '@/lib/store/types'

const EN = {
  addMethod: 'Add payment method',
  changeMethod: 'Change payment method',
  deleteMethod: 'Delete payment method',
  name: 'Name',
  type: 'Type',
  last4: 'Last 4 digits',
  currency: 'Currency',
  color: 'Color',
  makeDefault: 'Default',
  yes: 'Yes',
  none: '—',
  creditCardDebt: 'A linked credit card debt is created too.',
  cashFixed: 'Cash is built in. Only its default status can change.',
  exists: 'A payment method with that name already exists.',
  closedKeepsHistory: 'Has history, so it is closed: past entries stay with it',
  newDefault: (name: string) => `${name} becomes the default`,
  types: {
    cash: 'Cash',
    bank_account: 'Bank account',
    debit_card: 'Debit card',
    credit_card: 'Credit card',
    prepaid_card: 'Prepaid card',
    wallet: 'Wallet',
    bnpl: 'Buy now, pay later',
    other: 'Other',
  } satisfies Record<PaymentMethodType, string>,
}

type Labels = typeof EN

const AR: Labels = {
  addMethod: 'إضافة طريقة دفع',
  changeMethod: 'تعديل طريقة دفع',
  deleteMethod: 'حذف طريقة دفع',
  name: 'الاسم',
  type: 'النوع',
  last4: 'آخر 4 أرقام',
  currency: 'العملة',
  color: 'اللون',
  makeDefault: 'الافتراضية',
  yes: 'نعم',
  none: '—',
  creditCardDebt: 'سيتم إنشاء دين بطاقة ائتمان مرتبط بها أيضًا.',
  cashFixed: 'النقد مدمج في التطبيق. يمكن تغيير كونه الافتراضي فقط.',
  exists: 'توجد طريقة دفع بهذا الاسم بالفعل.',
  closedKeepsHistory: 'لديها سجل، لذا تُغلق وتبقى المدخلات السابقة معها',
  newDefault: (name) => `${name} تصبح الافتراضية`,
  types: {
    cash: 'نقد',
    bank_account: 'حساب بنكي',
    debit_card: 'بطاقة خصم',
    credit_card: 'بطاقة ائتمان',
    prepaid_card: 'بطاقة مسبقة الدفع',
    wallet: 'محفظة',
    bnpl: 'اشترِ الآن وادفع لاحقًا',
    other: 'أخرى',
  },
}

export const paymentLabels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)
