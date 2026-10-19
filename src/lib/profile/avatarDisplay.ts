import type { UserProfile } from '@/lib/store/types'
import { avatarDataUri } from '@/lib/profile/avatarArt'

/** Resolved image src for header / profile, or null to show fallback icon. */
export function resolveProfileAvatarSrc(profile: Pick<UserProfile, 'avatar' | 'avatarPresetId'>): string | null {
  const a = profile.avatar?.trim()
  if (a) {
    if (a.startsWith('data:image/') || a.startsWith('http://') || a.startsWith('https://')) {
      return a
    }
  }
  const preset = profile.avatarPresetId?.trim()
  return preset ? avatarDataUri(preset) : null
}
