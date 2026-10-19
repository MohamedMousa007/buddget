import {
  Baby, Banknote, Briefcase, Bus, CalendarDays, Car, Clapperboard, Coins, CreditCard, Droplets,
  Dumbbell, Fuel, Gift, GraduationCap, HandHeart, HeartPulse, House, Landmark, Layers, Package,
  Plane, Receipt, ShieldCheck, ShoppingBag, ShoppingBasket, Smartphone, Sprout, Target, TrendingUp,
  UtensilsCrossed, Users, Wallet, Wifi, Zap, type LucideIcon,
} from 'lucide-react'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { lineIconKey } from '@/lib/budget/lineIcons'

export const LINE_ICON_MAP: Record<string, LucideIcon> = {
  house: House, zap: Zap, smartphone: Smartphone, wifi: Wifi, 'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap, receipt: Receipt, 'rotate-cw-clock': RotateCwClock as LucideIcon,
  'credit-card': CreditCard, landmark: Landmark, 'trending-up': TrendingUp,
  'shopping-basket': ShoppingBasket, 'utensils-crossed': UtensilsCrossed, car: Car, fuel: Fuel,
  bus: Bus, 'shopping-bag': ShoppingBag, clapperboard: Clapperboard, users: Users,
  'shield-check': ShieldCheck, target: Target, sprout: Sprout, 'hand-heart': HandHeart,
  'calendar-days': CalendarDays, layers: Layers, wallet: Wallet, plane: Plane, baby: Baby,
  dumbbell: Dumbbell, gift: Gift, banknote: Banknote, coins: Coins, briefcase: Briefcase,
  droplets: Droplets, package: Package,
}

/** A Lucide key (or a legacy emoji) as a static component; Wallet when unknown. */
export function lineIconComponent(name: string): LucideIcon {
  return LINE_ICON_MAP[lineIconKey(name)] ?? Wallet
}
