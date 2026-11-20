import { useLocale } from '@/lib/i18n'
import { arPlural } from '@/lib/i18n/arPlural'
import type { Locale } from '@/lib/i18n/types'
import type { BudgetChapter } from '@/lib/budget/blocks'

/** Words for building a budget inside the Buddgy chat (plan 2.1). Amounts arrive formatted. */
export interface BuddgyPlanCopy {
  start: { title: string; here: string; hereSub: string; builder: string; builderSub: string; cost: string; started: string }
  progress: (n: number, of: number) => string
  pause: string
  paused: string
  resume: string
  back: string
  placeholder: string
  notUnderstood: string
  ready: {
    lead: string
    title: string
    chapters: Record<BudgetChapter, string>
    more: (n: number) => string
    review: string
    change: string
    note: string
    handed: string
  }
}

const en: BuddgyPlanCopy = {
  start: {
    title: 'Build your budget',
    here: 'Build it here with me',
    hereSub: 'A few quick questions, then you review it',
    builder: 'Open the budget builder',
    builderSub: 'The full builder, step by step',
    cost: 'Building here uses 1 AI budget build, not your chat usage.',
    started: 'Building it here with you.',
  },
  progress: (n, of) => `Building your plan · question ${n} of about ${of}`,
  pause: 'Pause',
  paused: 'Your plan is paused. Pick it up whenever you like.',
  resume: 'Continue the plan',
  back: 'Back',
  placeholder: 'Or type your answer',
  notUnderstood: 'I didn’t catch that. Tap an answer, or type it another way.',
  ready: {
    lead: 'That’s everything I need. Here’s the plan I’d start from.',
    title: 'Your plan',
    chapters: { mustPay: 'Must pay', live: 'Everyday', secure: 'Saving' },
    more: (n) => `${n} more ${n === 1 ? 'line' : 'lines'}`,
    review: 'Review and save in the builder',
    change: 'Change an answer',
    note: 'Nothing is saved until you review it in the builder.',
    handed: 'Opened in the builder to review and save.',
  },
}

const ar: BuddgyPlanCopy = {
  start: {
    title: 'ابنِ ميزانيتك',
    here: 'ابنِها هنا معي',
    hereSub: 'أسئلة سريعة قليلة، ثم تراجعها',
    builder: 'افتح منشئ الميزانية',
    builderSub: 'المنشئ الكامل، خطوة بخطوة',
    cost: 'البناء هنا يستخدم بناء ميزانية واحدًا بالذكاء الاصطناعي، وليس من استخدامك للمحادثة.',
    started: 'نبنيها هنا معًا.',
  },
  progress: (n, of) => `نبني خطتك · السؤال ${n} من حوالي ${of}`,
  pause: 'إيقاف مؤقت',
  paused: 'خطتك متوقفة مؤقتًا. أكملها وقتما تشاء.',
  resume: 'أكمل الخطة',
  back: 'رجوع',
  placeholder: 'أو اكتب إجابتك',
  notUnderstood: 'لم أفهم ذلك. اضغط على إجابة، أو اكتبها بطريقة أخرى.',
  ready: {
    lead: 'هذا كل ما أحتاجه. هذه الخطة التي سأبدأ منها.',
    title: 'خطتك',
    chapters: { mustPay: 'التزامات', live: 'يومي', secure: 'ادخار' },
    more: (n) => `${arPlural(n, { one: 'بند', two: 'بندين', few: 'بنود', many: 'بندًا' })} أخرى`,
    review: 'راجع واحفظ في المنشئ',
    change: 'غيّر إجابة',
    note: 'لا يُحفظ شيء حتى تراجعه في المنشئ.',
    handed: 'فُتحت في المنشئ للمراجعة والحفظ.',
  },
}

export const buddgyPlanCopy: Record<Locale, BuddgyPlanCopy> = { en, ar }

export function useBuddgyPlanCopy(): BuddgyPlanCopy {
  return buddgyPlanCopy[useLocale().locale]
}
