import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import type { InvestmentAssetType } from '@/lib/store/types'

interface Labels {
  pocket: string
  from: string
  to: string
  name: string
  type: string
  amount: string
  arrivesAs: string
  source: string
  balance: string
  purpose: string
  openingBalance: string
  addPocket: string
  deposit: string
  withdraw: string
  transfer: string
  correct: string
  deletePocket: string
  addAsset: string
  changeAsset: string
  deleteAsset: string
  kinds: { bank: string; wallet: string; cash: string; other: string }
  sources: { allocate: string; declare: string }
  purposes: { income: string; spend: string }
  assetTypes: Record<InvestmentAssetType, string>
  karat: string
  quantity: string
  symbol: string
  value: string
  size: string
  paid: string
  date: string
  worth: (amount: string) => string
  unpriced: string
  allocateEffect: (amount: string) => string
  declareEffect: string
  incomeEffect: (amount: string) => string
  spendEffect: string
  moveEffect: string
  correctEffect: string
  goalsAffected: (names: string) => string
  deleteEffect: (entries: number, amount: string) => string
  unlinkGoals: (names: string) => string
  duplicate: string
  history: string
  scheduled: string
}

const EN: Labels = {
  pocket: 'Pocket',
  from: 'From',
  to: 'To',
  name: 'Name',
  type: 'Type',
  amount: 'Amount',
  arrivesAs: 'Arrives as',
  source: 'Money from',
  balance: 'Balance',
  purpose: 'Purpose',
  openingBalance: 'What is in it now',
  addPocket: 'New pocket',
  deposit: 'Add to savings',
  withdraw: 'Withdraw from savings',
  transfer: 'Move between pockets',
  correct: 'Correct balance',
  deletePocket: 'Delete pocket',
  addAsset: 'Add asset',
  changeAsset: 'Change asset',
  deleteAsset: 'Delete asset',
  kinds: { bank: 'Bank account', wallet: 'Mobile wallet', cash: 'Cash', other: 'Other' },
  sources: { allocate: 'This month’s budget', declare: 'Money I already had' },
  purposes: { income: 'Income for this month', spend: 'Spent outside the budget' },
  assetTypes: { gold: 'Gold', crypto: 'Crypto', stock: 'Stock', property: 'Property' },
  karat: 'Karat',
  quantity: 'Quantity',
  symbol: 'Symbol',
  value: 'Value',
  size: 'Size (m²)',
  paid: 'Paid',
  date: 'Purchase date',
  worth: (a) => `Worth about ${a} today.`,
  unpriced: 'No live price yet, so it is not counted in net worth until it is priced.',
  allocateEffect: (a) => `Left to spend drops by ${a}.`,
  declareEffect: 'Net worth rises. Left to spend does not change.',
  incomeEffect: (a) => `Adds ${a} to this month’s income.`,
  spendEffect: 'The money leaves your savings. No income is recorded.',
  moveEffect: 'Net worth and left to spend do not change.',
  correctEffect: 'Recorded as a correction, not as cash flow.',
  goalsAffected: (n) => `Affects goals: ${n}.`,
  deleteEffect: (n, a) => `Its ${n} ledger entries and scheduled deposits are deleted. Net worth drops by ${a}.`,
  unlinkGoals: (n) => `Unlinked from goals: ${n}.`,
  duplicate: 'You already have a pocket with this name.',
  history: 'History',
  scheduled: 'Scheduled deposits',
}

const AR: Labels = {
  pocket: 'الجيب',
  from: 'من',
  to: 'إلى',
  name: 'الاسم',
  type: 'النوع',
  amount: 'المبلغ',
  arrivesAs: 'يصل بقيمة',
  source: 'مصدر المال',
  balance: 'الرصيد',
  purpose: 'الغرض',
  openingBalance: 'الرصيد الحالي',
  addPocket: 'جيب جديد',
  deposit: 'إضافة إلى المدخرات',
  withdraw: 'سحب من المدخرات',
  transfer: 'نقل بين الجيوب',
  correct: 'تصحيح الرصيد',
  deletePocket: 'حذف جيب',
  addAsset: 'إضافة أصل',
  changeAsset: 'تعديل أصل',
  deleteAsset: 'حذف أصل',
  kinds: { bank: 'حساب بنكي', wallet: 'محفظة إلكترونية', cash: 'نقدي', other: 'أخرى' },
  sources: { allocate: 'ميزانية هذا الشهر', declare: 'مال كان معي من قبل' },
  purposes: { income: 'دخل لهذا الشهر', spend: 'صرف خارج الميزانية' },
  assetTypes: { gold: 'ذهب', crypto: 'عملات رقمية', stock: 'أسهم', property: 'عقار' },
  karat: 'العيار',
  quantity: 'الكمية',
  symbol: 'الرمز',
  value: 'القيمة',
  size: 'المساحة (م²)',
  paid: 'المدفوع',
  date: 'تاريخ الشراء',
  worth: (a) => `قيمته اليوم نحو ${a}.`,
  unpriced: 'لا يوجد سعر مباشر بعد، لذا لا يُحتسب في صافي الثروة حتى يتوفر سعره.',
  allocateEffect: (a) => `يقلّ المتبقي للصرف بمقدار ${a}.`,
  declareEffect: 'ترتفع ثروتك الصافية ولا يتغيّر المتبقي للصرف.',
  incomeEffect: (a) => `يُضاف ${a} إلى دخل هذا الشهر.`,
  spendEffect: 'يخرج المال من مدخراتك ولا يُسجَّل كدخل.',
  moveEffect: 'لا تتغيّر ثروتك الصافية ولا المتبقي للصرف.',
  correctEffect: 'يُسجَّل كتصحيح وليس كحركة نقدية.',
  goalsAffected: (n) => `يؤثر على الأهداف: ${n}.`,
  deleteEffect: (n, a) => `تُحذف ${n} حركة وإيداعاتها المجدولة. تنخفض ثروتك الصافية بمقدار ${a}.`,
  unlinkGoals: (n) => `يُفصل عن الأهداف: ${n}.`,
  duplicate: 'لديك جيب بهذا الاسم بالفعل.',
  history: 'السجل',
  scheduled: 'الإيداعات المجدولة',
}

export const savingsLabels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)
