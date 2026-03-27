import type { LucideIcon } from 'lucide-react'
import {
  PiggyBank,
  Wallet,
  TrendingUp,
  Shield,
  Sparkles,
  Target,
  Landmark,
  Coins,
} from 'lucide-react'

export type AvatarPreset = {
  id: string
  label: string
  Icon: LucideIcon
  /** Tailwind bg + text classes matching Buddget brand */
  swatchClass: string
}

export const PROFILE_AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'preset_piggy', label: 'Save', Icon: PiggyBank, swatchClass: 'bg-red-500/20 text-[var(--color-brand-red)]' },
  { id: 'preset_wallet', label: 'Wallet', Icon: Wallet, swatchClass: 'bg-rose-500/15 text-rose-200' },
  { id: 'preset_growth', label: 'Growth', Icon: TrendingUp, swatchClass: 'bg-emerald-500/15 text-emerald-300' },
  { id: 'preset_shield', label: 'Safe', Icon: Shield, swatchClass: 'bg-slate-500/20 text-slate-200' },
  { id: 'preset_spark', label: 'Spark', Icon: Sparkles, swatchClass: 'bg-amber-500/15 text-[var(--color-brand-gold)]' },
  { id: 'preset_target', label: 'Goals', Icon: Target, swatchClass: 'bg-red-900/40 text-[var(--color-brand-red)]' },
  { id: 'preset_bank', label: 'Bank', Icon: Landmark, swatchClass: 'bg-zinc-600/30 text-zinc-200' },
  { id: 'preset_coins', label: 'Coins', Icon: Coins, swatchClass: 'bg-yellow-600/15 text-yellow-200' },
]
