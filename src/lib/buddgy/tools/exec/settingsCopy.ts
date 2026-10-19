import type { ToolContext } from '@/lib/buddgy/tools/types'

const EN = {
  change: (label: string) => `Change setting: ${label}`,
  on: 'On',
  off: 'Off',
  english: 'English',
  arabic: 'العربية',
  day: (n: number) => `Day ${n}`,
  auto: 'Auto',
  onlyMine: 'Only my currencies in forms',
  monthStart: 'Month starts on',
  cycleNote: 'Past entries keep their dates; your months are cut differently from now on.',
  range: (from: string, to: string) => `${from} → ${to}`,
}

const AR: typeof EN = {
  change: (label) => `تغيير الإعداد: ${label}`,
  on: 'مفعّل',
  off: 'متوقف',
  english: 'English',
  arabic: 'العربية',
  day: (n) => `اليوم ${n}`,
  auto: 'تلقائي',
  onlyMine: 'عملاتي فقط في النماذج',
  monthStart: 'يبدأ الشهر في',
  cycleNote: 'تحتفظ الإدخالات السابقة بتواريخها؛ وتُقسَّم أشهرك بشكل مختلف من الآن.',
  range: (from, to) => `${from} → ${to}`,
}

export const settingsLabels = (locale: ToolContext['locale']) => (locale === 'ar' ? AR : EN)
