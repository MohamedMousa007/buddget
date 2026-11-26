import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'

/** The Goals list when a view has nothing in it (light touch QA): a card, not a bare line. */
export interface GoalsEmptyCopy {
  activeTitle: string
  activeBody: string
  pausedTitle: string
  pausedBody: string
  newGoal: string
  seePaused: string
}

export const GOALS_EMPTY_COPY: Record<Locale, GoalsEmptyCopy> = {
  en: {
    activeTitle: 'No active goals',
    activeBody: 'Start a goal and buddget sets aside a little each month, so you get there without thinking about it.',
    pausedTitle: 'No paused goals',
    pausedBody: 'A goal you pause waits here until you resume it.',
    newGoal: 'New goal',
    seePaused: 'See paused goals',
  },
  ar: {
    activeTitle: 'لا أهداف نشطة',
    activeBody: 'ابدأ هدفًا وسيخصص buddget جزءًا صغيرًا كل شهر، فتصل إليه دون أن تفكر فيه.',
    pausedTitle: 'لا أهداف متوقفة',
    pausedBody: 'الهدف الذي توقفه ينتظر هنا حتى تستأنفه.',
    newGoal: 'هدف جديد',
    seePaused: 'عرض الأهداف المتوقفة',
  },
}

export function useGoalsEmptyCopy(): GoalsEmptyCopy {
  return GOALS_EMPTY_COPY[useLocale().locale]
}
