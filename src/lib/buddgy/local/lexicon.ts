import type { ExpenseCategory } from '@/lib/store/types'
import { foldArabic } from './text'

interface LexiconEntry {
  category: ExpenseCategory
  en: string
  ar: string
}

const LEXICON: LexiconEntry[] = [
  {
    category: 'Food',
    en: 'coffee|cafe|lunch|dinner|breakfast|brunch|snack|restaurant|pizza|burger|shawarma|talabat|elmenus|mcdonald|kfc|starbucks|takeout|juice|sandwich',
    ar: 'قهوة|كافيه|كوفي|مطعم|مطاعم|غدا|غداء|عشا|عشاء|فطار|فطور|اكل|طلبات|بيتزا|برجر|شاورما|عصير|ساندوتش',
  },
  {
    category: 'Groceries',
    en: 'grocer|supermarket|carrefour|spinneys|hypermarket|lulu|vegetables',
    ar: 'سوبر ماركت|سوبرماركت|بقالة|بقال|هايبر|خضار|كارفور|ماركت',
  },
  {
    category: 'Transport',
    en: 'uber|careem|taxi|cab|metro|bus\\b|train|indrive|parking|toll',
    ar: 'تاكسي|اوبر|مترو|اتوبيس|باص|مواصلات|توك توك|ميكروباص|موقف',
  },
  { category: 'Fuel', en: 'petrol|fuel|gasoline|diesel', ar: 'بنزين|سولار|وقود' },
  { category: 'Rent', en: 'rent', ar: 'ايجار' },
  {
    category: 'Utilities',
    en: 'electricity|water|internet|wifi|wi-fi',
    ar: 'كهرباء|مياه|ميه|انترنت|وايفاي|غاز',
  },
  {
    category: 'Health',
    en: 'pharmacy|doctor|medicine|clinic|hospital|dentist',
    ar: 'دواء|دوا|صيدلية|دكتور|طبيب|عيادة|مستشفى',
  },
  {
    category: 'Subscription',
    en: 'netflix|spotify|subscription|shahid|icloud|youtube premium',
    ar: 'اشتراك|نتفليكس|سبوتيفاي|شاهد',
  },
  {
    category: 'Enjoyment',
    en: 'cinema|movie|game|gaming|playstation|concert',
    ar: 'سينما|لعبة|العاب|بلايستيشن',
  },
  {
    category: 'Shopping',
    en: 'clothes|shoes|shirt|amazon|noon\\b|jumia',
    ar: 'ملابس|هدوم|جزمة|حذاء|امازون|نون',
  },
  {
    category: 'Education',
    en: 'school|course|tuition|university|education',
    ar: 'تعليم|مدرسة|كورس|دورة|جامعة',
  },
]

const COMPILED = LEXICON.map(({ category, en, ar }) => ({
  category,
  en: new RegExp(`\\b(?:${en})`, 'i'),
  ar: new RegExp(`(?<![\\p{L}])(?:ال|بال|وال|ب|ل|و)?(?:${foldArabic(ar)})(?![\\p{L}])`, 'iu'),
}))

/** Distinct categories whose keywords appear in the text. */
export function matchCategories(text: string): ExpenseCategory[] {
  return COMPILED.filter(({ en, ar }) => en.test(text) || ar.test(text)).map((e) => e.category)
}
