import {
  Award, Bell, BookOpen, Briefcase, Car, Coins, Gem, Gift, GraduationCap, Heart, HeartPulse, Home, Image, Landmark,
  LineChart, MoonStar, Plane, Scale, Shield, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Store, Target, TrendingDown,
  TrendingUp, Trophy, Unlock, User, Users, UtensilsCrossed, Wallet, Zap, type LucideIcon,
} from 'lucide-react'
import type { Goal, GoalCategory } from '@/lib/store/types'

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

/** The icons a goal of your own (Other) can wear: the app's own lucide set, so it looks at home everywhere. */
export const GOAL_ICON_SET = {
  target: Target, plane: Plane, house: Home, car: Car, 'graduation-cap': GraduationCap, 'heart-pulse': HeartPulse,
  smartphone: Smartphone, 'moon-star': MoonStar, 'shield-check': ShieldCheck, user: User, 'trending-up': TrendingUp,
  briefcase: Briefcase, gem: Gem, trophy: Trophy, award: Award, coins: Coins, wallet: Wallet, landmark: Landmark,
  'shopping-bag': ShoppingBag, 'utensils-crossed': UtensilsCrossed, sparkles: Sparkles, zap: Zap, scale: Scale, bell: Bell,
  image: Image,
} as const satisfies Record<string, LucideIcon>

export type GoalIconKey = keyof typeof GOAL_ICON_SET

export const isGoalIconKey = (v: string | null | undefined): v is GoalIconKey => !!v && Object.prototype.hasOwnProperty.call(GOAL_ICON_SET, v)

/** A goal's look: its category's, except a goal of your own (Other) whose `emoji` holds an icon key picked for it. */
export function goalVisualFor(goal: Pick<Goal, 'category' | 'emoji'>): GoalVisual {
  const v = goalVisual(goal.category)
  return goal.category === 'custom' && isGoalIconKey(goal.emoji) ? { ...v, icon: GOAL_ICON_SET[goal.emoji] } : v
}
