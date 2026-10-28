import type { SiteLocale } from '../config'
import { SHOW_SAMPLE_REVIEWS } from '../config'
import type { Review } from './types'

/** Real reviews, added with each person's permission. While this is empty the section stays hidden in production. */
export const REAL_REVIEWS: Record<SiteLocale, Review[]> = { en: [], ar: [] }

/** Design placeholders. Rendered only when NEXT_PUBLIC_SITE_SAMPLE_REVIEWS=1, and always flagged on the page. */
const SAMPLE: Record<SiteLocale, Review[]> = {
  en: [
    { quote: 'I always said I spend about 3,000 a week. Turns out food delivery alone was most of it. Seeing it by category changed what I order.', name: 'Mona H.', meta: 'Cairo · 5 weeks with Buddget', initial: 'M' },
    { quote: 'The bank texts just show up as expenses. I only fix the odd one. I stopped opening a spreadsheet at the end of the month.', name: 'Karim S.', meta: 'Alexandria · 3 months with Buddget', initial: 'K' },
    { quote: 'The daily number is the thing. Ten days to payday and 687 a day, I check it before I order lunch.', name: 'Nour A.', meta: 'Giza · 2 months with Buddget', initial: 'N' },
    { quote: 'We set the laptop goal with a date. It told me 2,000 a month gets me there in February. I did not know that before.', name: 'Omar E.', meta: 'Cairo · 6 weeks with Buddget', initial: 'O' },
    { quote: 'I found two subscriptions I forgot about. That paid for the month on its own.', name: 'Salma R.', meta: 'Mansoura · 4 weeks with Buddget', initial: 'S' },
    { quote: 'I asked Buddgy in Arabic where my money went and it answered in a sentence. No charts to read.', name: 'Hassan F.', meta: 'Tanta · 7 weeks with Buddget', initial: 'H' },
  ],
  ar: [
    { quote: 'كنت أقول دائمًا إنني أنفق نحو 3,000 في الأسبوع. تبيّن أن الطعام الجاهز وحده كان معظمها. وعندما رأيته حسب الفئة تغيّر ما أطلبه.', name: 'منى ح.', meta: 'القاهرة · 5 أسابيع مع Buddget', initial: 'م' },
    { quote: 'رسائل البنك تظهر وحدها كمصروفات. أصحّح واحدة بين حين وآخر. توقفت عن فتح جدول البيانات في آخر الشهر.', name: 'كريم س.', meta: 'الإسكندرية · 3 أشهر مع Buddget', initial: 'ك' },
    { quote: 'الرقم اليومي هو الأهم. بقيت 10 أيام على الراتب و687 في اليوم، أنظر إليه قبل أن أطلب الغداء.', name: 'نور أ.', meta: 'الجيزة · شهران مع Buddget', initial: 'ن' },
    { quote: 'حدّدنا هدف الحاسوب بتاريخ. أخبرني أن 2,000 شهريًا توصلني في فبراير. لم أكن أعرف ذلك من قبل.', name: 'عمر ع.', meta: 'القاهرة · 6 أسابيع مع Buddget', initial: 'ع' },
    { quote: 'وجدت اشتراكين نسيتهما. وفّر ذلك مصروف الشهر وحده.', name: 'سلمى ر.', meta: 'المنصورة · 4 أسابيع مع Buddget', initial: 'س' },
    { quote: 'سألت Buddgy بالعربية أين ذهبت أموالي فأجابني بجملة واحدة. دون رسوم بيانية لأقرأها.', name: 'حسن ف.', meta: 'طنطا · 7 أسابيع مع Buddget', initial: 'ح' },
  ],
}

export function reviewsFor(locale: SiteLocale): { reviews: Review[]; isSample: boolean } {
  const real = REAL_REVIEWS[locale]
  if (real.length > 0) return { reviews: real, isSample: false }
  return { reviews: SHOW_SAMPLE_REVIEWS ? SAMPLE[locale] : [], isSample: true }
}
