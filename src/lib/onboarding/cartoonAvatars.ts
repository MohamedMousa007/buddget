/**
 * Cartoon-style avatars via DiceBear — distinct seeds and styles.
 * @see https://www.dicebear.com/styles/avataaars/
 */
export const CARTOON_AVATAR_PRESETS: { id: string; label: string; seed: string; bg: string; style?: string }[] = [
  { id: 'toon_a', label: 'Sunny', seed: 'buddget-sunny', bg: 'fee2e2' },
  { id: 'toon_b', label: 'River', seed: 'buddget-river', bg: 'e0e7ff' },
  { id: 'toon_c', label: 'Mika', seed: 'buddget-mika', bg: 'dcfce7' },
  { id: 'toon_d', label: 'Alex', seed: 'buddget-alex', bg: 'fef3c7' },
  { id: 'toon_e', label: 'Jordan', seed: 'buddget-jordan', bg: 'fce7f3' },
  { id: 'toon_f', label: 'Sam', seed: 'buddget-sam', bg: 'e0f2fe' },
  { id: 'toon_g', label: 'Riley', seed: 'buddget-riley', bg: 'f3e8ff' },
  { id: 'toon_h', label: 'Casey', seed: 'buddget-casey', bg: 'ffedd5' },
  // Adventurer style
  { id: 'adv_felix', label: 'Felix', seed: 'Felix', bg: 'fee2e2', style: 'adventurer' },
  { id: 'adv_aneka', label: 'Aneka', seed: 'Aneka', bg: 'e0e7ff', style: 'adventurer' },
  { id: 'adv_milo', label: 'Milo', seed: 'Milo', bg: 'dcfce7', style: 'adventurer' },
  { id: 'adv_zara', label: 'Zara', seed: 'Zara', bg: 'fef3c7', style: 'adventurer' },
  { id: 'adv_kai', label: 'Kai', seed: 'Kai', bg: 'fce7f3', style: 'adventurer' },
  { id: 'adv_nova', label: 'Nova', seed: 'Nova', bg: 'e0f2fe', style: 'adventurer' },
  { id: 'adv_axel', label: 'Axel', seed: 'Axel', bg: 'f3e8ff', style: 'adventurer' },
  { id: 'adv_luna', label: 'Luna', seed: 'Luna', bg: 'ffedd5', style: 'adventurer' },
  // Big Ears style
  { id: 'be_buddy', label: 'Buddy', seed: 'Buddy', bg: 'fee2e2', style: 'big-ears' },
  { id: 'be_max', label: 'Max', seed: 'Max', bg: 'e0e7ff', style: 'big-ears' },
  { id: 'be_cleo', label: 'Cleo', seed: 'Cleo', bg: 'dcfce7', style: 'big-ears' },
  { id: 'be_rex', label: 'Rex', seed: 'Rex', bg: 'fef3c7', style: 'big-ears' },
  // Fun Emoji style
  { id: 'fe_alpha', label: 'Alpha', seed: 'Alpha', bg: 'fce7f3', style: 'fun-emoji' },
  { id: 'fe_beta', label: 'Beta', seed: 'Beta', bg: 'e0f2fe', style: 'fun-emoji' },
  { id: 'fe_gamma', label: 'Gamma', seed: 'Gamma', bg: 'f3e8ff', style: 'fun-emoji' },
  { id: 'fe_delta', label: 'Delta', seed: 'Delta', bg: 'ffedd5', style: 'fun-emoji' },
]

export function cartoonAvatarUrlForPreset(presetId: string): string {
  const row = CARTOON_AVATAR_PRESETS.find((p) => p.id === presetId)
  const seed = row?.seed ?? presetId
  const bg = row?.bg ?? 'fee2e2'
  const style = row?.style ?? 'avataaars'
  const params = new URLSearchParams({
    seed,
    backgroundColor: bg,
    radius: '50',
  })
  return `https://api.dicebear.com/7.x/${style}/svg?${params.toString()}`
}

export function defaultCartoonPresetId(): string {
  return CARTOON_AVATAR_PRESETS[0].id
}
