import {
  BookOpen, Briefcase, Car, Coins, Gift, GraduationCap, Heart, Home, LineChart, Plane,
  Shield, Smartphone, Sparkles, Store, TrendingDown, Unlock, Users, type LucideIcon,
} from 'lucide-react'
import type { GoalCategory } from '@/lib/store/types'

interface GoalVisual {
  icon: LucideIcon
  /** Index into the --color-cat-1..6 ramp. */
  cat: 1 | 2 | 3 | 4 | 5 | 6
}

const VISUAL: Record<GoalCategory, GoalVisual> = {
  emergency_fund: { icon: Shield, cat: 1 },
  house: { icon: Home, cat: 2 },
  car: { icon: Car, cat: 3 },
  vacation: { icon: Plane, cat: 5 },
  education: { icon: GraduationCap, cat: 4 },
  wedding: { icon: Heart, cat: 3 },
  phone_device: { icon: Smartphone, cat: 6 },
  family_support: { icon: Users, cat: 2 },
  sadaqah_charity: { icon: Heart, cat: 1 },
  gift: { icon: Gift, cat: 6 },
  investment: { icon: LineChart, cat: 2 },
  debt_freedom: { icon: Unlock, cat: 4 },
  quality_of_life: { icon: Sparkles, cat: 5 },
  spending_control: { icon: TrendingDown, cat: 3 },
  retirement: { icon: Briefcase, cat: 1 },
  business: { icon: Store, cat: 2 },
  custom: { icon: Coins, cat: 1 },
}

export const goalVisual = (c: GoalCategory): GoalVisual => VISUAL[c] ?? { icon: BookOpen, cat: 1 }
