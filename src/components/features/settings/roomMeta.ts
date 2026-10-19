import type { RowTone } from '@/components/features/settings/SettingsRow'
import type { RoomId } from '@/lib/settings/registry'

/** Each room keeps one category hue everywhere it appears: hub, search results, room pages. */
export const ROOM_TONE: Record<RoomId, RowTone> = {
  you: 1,
  money: 2,
  alerts: 3,
  buddgy: 4,
  look: 5,
  data: 6,
  help: 'neutral',
}
