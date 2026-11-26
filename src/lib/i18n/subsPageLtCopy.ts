import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** Light touch strings for the Subscriptions page sections and sheets (round-2 conformance). */
export interface SubsPageLtCopy {
  groups: { next30: string; paid: string; later: string; all: string; ended: string }
  add: string
  noCharges: string
  moreDetails: string
}

const SUBS_PAGE_LT_COPY: Record<Locale, SubsPageLtCopy> = {
  en: {
    groups: { next30: 'Next 30 days', paid: 'Paid this month', later: 'Later', all: 'All', ended: 'Ended' },
    add: 'Add',
    noCharges: 'No charges recorded yet',
    moreDetails: 'Trial, sharing and notes',
  },
  ar: {
    groups: { next30: 'الـ 30 يومًا القادمة', paid: 'مدفوع هذا الشهر', later: 'لاحقًا', all: 'الكل', ended: 'المنتهية' },
    add: 'إضافة',
    noCharges: 'لا توجد رسوم مسجلة بعد',
    moreDetails: 'التجربة والمشاركة والملاحظات',
  },
}

export function useSubsPageLtCopy(): SubsPageLtCopy {
  const { locale } = useLocale()
  return SUBS_PAGE_LT_COPY[locale]
}
