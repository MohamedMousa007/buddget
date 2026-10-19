import type { ToolContext } from '@/lib/buddgy/tools/types'

const EN = {
  change: (label: string) => `Change setting: ${label}`,
  on: 'On',
  off: 'Off',
  english: 'English',
  arabic: 'العربية',
  day: (n: number) => `Day ${n}`,
}

const AR: typeof EN = {
  change: (label) => `تغيير الإعداد: ${label}`,
  on: 'مفعّل',
  off: 'متوقف',
  english: 'English',
  arabic: 'العربية',
  day: (n) => `اليوم ${n}`,
}

export const settingsLabels = (locale: ToolContext['locale']) => (locale === 'ar' ? AR : EN)
