import type { RowTone } from '@/components/features/settings/SettingsRow'
import type { GroupId } from '@/lib/settings/registry'

/** Each settings group keeps one category hue wherever it appears: the page, search results, the memory screen. */
export const GROUP_TONE: Record<GroupId, RowTone> = {
  profile: 1,
  security: 1,
  quick: 2,
  autoTrack: 3,
  ai: 4,
  memory: 4,
  notifications: 5,
  data: 6,
  help: 'neutral',
}
