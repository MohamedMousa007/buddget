import {
  Baby, Banknote, Bike, Briefcase, Building2, Bus, Car, CalendarClock, Church, Coffee, CreditCard, Footprints, Gem, GraduationCap,
  Gift, HandCoins, Heart, Home, Key, Landmark, Laptop, PartyPopper, PiggyBank, Plane, Receipt, School, Scale, ShieldCheck, ShoppingBag,
  ShoppingBasket, Smile, Stethoscope, Store, Target, TrendingUp, Truck, Tv, User, Users, UtensilsCrossed, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

/** A glyph for the answers that have an obvious one; the rest stay text-only. Keys are option ids across the question graph. */
export const OPTION_ICONS: Record<string, LucideIcon> = {
  rent: Key, own: Home, family: Users, company: Building2, mortgage: Landmark, paid_off: Home, owned: Car, financed: CreditCard, leased: CalendarClock,
  solo: User, couple: Heart, public: Bus, car: Car, taxi: Truck, walk: Footprints, bike: Bike,
  salary: Banknote, freelance: Laptop, business: Store, seasonal: CalendarClock, mixed: Briefcase, benefits: Landmark, allowance: HandCoins,
  baby: Baby, wedding: Gem, move: Truck, medical: Stethoscope, school: School, teen: GraduationCap, under5: Baby, adult: User,
  card: CreditCard, loan: Landmark, bnpl: Receipt, student: GraduationCap, tax: Scale,
  dining: UtensilsCrossed, fun: PartyPopper, shopping: ShoppingBag, subscriptions: Tv, transport: Bus, groceries: ShoppingBasket, bills: Receipt,
  safety: ShieldCheck, debt: CreditCard, goals: Target, invest: TrendingUp, enjoy: Smile, travel: Plane, vacation: Plane, house: Home,
  education: GraduationCap, pilgrimage: Church, car_yearly: Car, school_start: School, festive: Gift, home_repairs: Wrench, renewals: CalendarClock,
  everyday: Coffee, employer: Briefcase, self: PiggyBank, extra_income: Zap, pause_goals: Target,
}
