/**
 * Cartoon-style avatars via Dicebear (avataaars) — distinct seeds, brand-tinted backgrounds.
 * @see https://www.dicebear.com/styles/avataaars/
 */
export const CARTOON_AVATAR_PRESETS: { id: string; label: string; seed: string; bg: string }[] = [
  { id: 'toon_a', label: 'Sunny', seed: 'buddget-sunny', bg: 'fee2e2' },
  { id: 'toon_b', label: 'River', seed: 'buddget-river', bg: 'e0e7ff' },
  { id: 'toon_c', label: 'Mika', seed: 'buddget-mika', bg: 'dcfce7' },
  { id: 'toon_d', label: 'Alex', seed: 'buddget-alex', bg: 'fef3c7' },
  { id: 'toon_e', label: 'Jordan', seed: 'buddget-jordan', bg: 'fce7f3' },
  { id: 'toon_f', label: 'Sam', seed: 'buddget-sam', bg: 'e0f2fe' },
  { id: 'toon_g', label: 'Riley', seed: 'buddget-riley', bg: 'f3e8ff' },
  { id: 'toon_h', label: 'Casey', seed: 'buddget-casey', bg: 'ffedd5' },
]

export function cartoonAvatarUrlForPreset(presetId: string): string {
  const row = CARTOON_AVATAR_PRESETS.find((p) => p.id === presetId)
  const seed = row?.seed ?? presetId
  const bg = row?.bg ?? 'fee2e2'
  const params = new URLSearchParams({
    seed,
    backgroundColor: bg,
    radius: '50',
  })
  return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`
}

export function defaultCartoonPresetId(): string {
  return CARTOON_AVATAR_PRESETS[0].id
}
