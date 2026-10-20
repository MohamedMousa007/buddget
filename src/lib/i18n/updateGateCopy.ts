import type { Locale } from '@/lib/i18n/types'

export interface UpdateGateCopy {
  title: string
  body: string
  cta: string
  noLink: string
}

/** The blocking "update required" screen. */
export const UPDATE_GATE_COPY: Record<Locale, UpdateGateCopy> = {
  en: {
    title: 'Update Buddget to continue',
    body: 'This version is out of date and can no longer connect. Your data is safe and will be here as soon as you update.',
    cta: 'Update now',
    noLink: 'Open your Buddget download link (TestFlight on iPhone, the download link on Android) and install the latest version.',
  },
  ar: {
    title: 'حدّث Buddget للمتابعة',
    body: 'هذا الإصدار قديم ولم يعد قادرًا على الاتصال. بياناتك بأمان وستجدها فور التحديث.',
    cta: 'حدّث الآن',
    noLink: 'افتح رابط تحميل Buddget (TestFlight على الآيفون، ورابط التحميل على أندرويد) وثبّت أحدث إصدار.',
  },
}
