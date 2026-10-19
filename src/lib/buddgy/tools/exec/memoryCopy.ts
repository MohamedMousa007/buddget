import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import type { BuddgyMemory } from '@/lib/store/types'

const EN = {
  remember: 'Remember this',
  forget: 'Forget this',
  note: 'Note',
  kind: 'Kind',
  kinds: { fact: 'Fact', preference: 'Preference', constraint: 'Constraint' } satisfies Record<BuddgyMemory['kind'], string>,
}

type Labels = typeof EN

const AR: Labels = {
  remember: 'تذكّر هذا',
  forget: 'انسَ هذا',
  note: 'الملاحظة',
  kind: 'النوع',
  kinds: { fact: 'معلومة', preference: 'تفضيل', constraint: 'قيد' },
}

export const memoryLabels = (locale: BuddgyLocale): Labels => (locale === 'ar' ? AR : EN)
