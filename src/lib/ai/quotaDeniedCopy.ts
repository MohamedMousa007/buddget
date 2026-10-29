import type { QuotaLayer } from '@/lib/server/ai/quota'

type Lang = 'en' | 'ar'

const COPY = {
  en: {
    limit: 'You’ve reached your AI limit for now.',
    resetAt: (when: string) => ` It resets around ${when}.`,
    rate: 'You’re sending requests too fast. Try again in a moment.',
    disabled: 'This AI feature isn’t available on your plan.',
    unavailable: 'AI is unavailable right now. Try again shortly.',
  },
  ar: {
    limit: 'وصلت إلى حد الذكاء الاصطناعي حاليًا.',
    resetAt: (when: string) => ` يتجدد تقريبًا في ${when}.`,
    rate: 'ترسل الطلبات بسرعة كبيرة. حاول بعد قليل.',
    disabled: 'ميزة الذكاء الاصطناعي هذه غير متاحة في خطتك.',
    unavailable: 'الذكاء الاصطناعي غير متاح الآن. حاول بعد قليل.',
  },
} as const

/** User-facing copy for a quota denial (see `quotaDeniedResponse`); never mentions the upstream provider. */
export function quotaDeniedMessage(layer: QuotaLayer | string | undefined, resetAt: string | null | undefined, lang: Lang): string {
  const c = COPY[lang]
  if (layer === 'feature_disabled') return c.disabled
  if (layer === 'unavailable') return c.unavailable
  if (layer === 'rate') return c.rate
  const reset = resetAt ? new Date(resetAt) : null
  if (!reset || Number.isNaN(reset.getTime())) return c.limit
  const when = reset.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return c.limit + c.resetAt(when)
}
