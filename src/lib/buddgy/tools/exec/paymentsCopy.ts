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
  expensesMoved: (n: number) => `${n} ${n === 1 ? 'expense moves' : 'expenses move'} to Cash`,
  subscriptionsUnlinked: (n: number) => `${n} ${n === 1 ? 'subscription loses' : 'subscriptions lose'} its payment method`,
  incomeUnlinked: (n: number) => `${n} income ${n === 1 ? 'entry loses' : 'entries lose'} its payment method`,
  debtUnlinked: (name: string) => `Debt "${name}" stays but is unlinked`,
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
  expensesMoved: (n) => `${n} ${n === 1 ? 'مصروف ينتقل' : 'مصروفات تنتقل'} إلى النقد`,
  subscriptionsUnlinked: (n) => `${n} ${n === 1 ? 'اشتراك يفقد' : 'اشتراكات تفقد'} طريقة الدفع`,
  incomeUnlinked: (n) => `${n} ${n === 1 ? 'دخل يفقد' : 'مدخلات دخل تفقد'} طريقة الدفع`,
  debtUnlinked: (name) => `الدين "${name}" يبقى لكن بلا ربط`,
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
