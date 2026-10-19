import type { Currency } from '@/lib/store/types'
import type { BudgetFacts, EverydayKey } from '@/lib/budget/facts'

type Lifestyle = BudgetFacts['lifestyle']
type Household = BudgetFacts['household']
type TransportMode = NonNullable<BudgetFacts['transportMode']>

/** Absolute monthly figures in the country's own currency. Heuristic v1: tune freely, nothing depends on exact values. */
interface AbsoluteTable {
  groceriesPerPerson: Record<Lifestyle, number>
  diningPerPerson: Record<Lifestyle, number>
  transportPerHousehold: Record<TransportMode, number>
  healthPerPerson: number
  shoppingPerPerson: Record<Lifestyle, number>
  funPerPerson: Record<Lifestyle, number>
  phonePerAdult: number
  perDependent: number
  supportingOthers: number
  utilitiesByHousehold: Record<Household, number>
}

/** Share-of-income ratios; the fallback everywhere an absolute table does not apply. */
interface RatioTable {
  /** Housing above this share of income gets flagged, never forced. */
  housingCap: number
  /** Essentials above this share are common on lower incomes and are not treated as a fault. */
  essentialsShare: number
  utilities: number
  everyday: Record<EverydayKey, number>
}

export interface Benchmark {
  id: 'AE' | 'EG' | 'SA' | 'generic'
  label: string
  /** Currency the absolute table is denominated in; null for the generic fallback. */
  currency: Currency | null
  absolute: AbsoluteTable | null
  ratios: RatioTable
}

const RATIOS: RatioTable = {
  housingCap: 0.33,
  essentialsShare: 0.55,
  utilities: 0.06,
  everyday: {
    groceries: 0.12,
    dining: 0.05,
    transport: 0.08,
    health: 0.03,
    shopping: 0.04,
    fun: 0.04,
    family: 0.03,
    other: 0.03,
  },
}

const GENERIC: Benchmark = { id: 'generic', label: 'General guidance', currency: null, absolute: null, ratios: RATIOS }

const UAE: Benchmark = {
  id: 'AE',
  label: 'UAE',
  currency: 'AED',
  ratios: { ...RATIOS, housingCap: 0.35 },
  absolute: {
    groceriesPerPerson: { minimal: 650, balanced: 900, comfortable: 1300 },
    diningPerPerson: { minimal: 150, balanced: 500, comfortable: 1200 },
    transportPerHousehold: { public: 300, car: 1100, taxi: 900, walk: 100 },
    healthPerPerson: 250,
    shoppingPerPerson: { minimal: 250, balanced: 600, comfortable: 1500 },
    funPerPerson: { minimal: 150, balanced: 450, comfortable: 1100 },
    phonePerAdult: 150,
    perDependent: 700,
    supportingOthers: 800,
    utilitiesByHousehold: { solo: 450, couple: 600, family: 900 },
  },
}

const EGYPT: Benchmark = {
  id: 'EG',
  label: 'Egypt',
  currency: 'EGP',
  ratios: { ...RATIOS, housingCap: 0.3, essentialsShare: 0.6 },
  absolute: {
    groceriesPerPerson: { minimal: 3500, balanced: 5000, comfortable: 8000 },
    diningPerPerson: { minimal: 600, balanced: 2000, comfortable: 5000 },
    transportPerHousehold: { public: 1200, car: 4500, taxi: 3500, walk: 300 },
    healthPerPerson: 800,
    shoppingPerPerson: { minimal: 500, balanced: 1500, comfortable: 4000 },
    funPerPerson: { minimal: 400, balanced: 1200, comfortable: 3000 },
    phonePerAdult: 300,
    perDependent: 3000,
    supportingOthers: 1500,
    utilitiesByHousehold: { solo: 1500, couple: 2000, family: 3000 },
  },
}

const SAUDI: Benchmark = {
  id: 'SA',
  label: 'Saudi Arabia',
  currency: 'SAR',
  ratios: { ...RATIOS, housingCap: 0.33 },
  absolute: {
    groceriesPerPerson: { minimal: 600, balanced: 900, comfortable: 1400 },
    diningPerPerson: { minimal: 150, balanced: 450, comfortable: 1100 },
    transportPerHousehold: { public: 250, car: 900, taxi: 800, walk: 80 },
    healthPerPerson: 200,
    shoppingPerPerson: { minimal: 300, balanced: 700, comfortable: 1500 },
    funPerPerson: { minimal: 150, balanced: 400, comfortable: 1000 },
    phonePerAdult: 130,
    perDependent: 500,
    supportingOthers: 400,
    utilitiesByHousehold: { solo: 350, couple: 500, family: 800 },
  },
}

const ALIASES: Record<string, Benchmark> = {
  ae: UAE,
  are: UAE,
  uae: UAE,
  'united arab emirates': UAE,
  emirates: UAE,
  eg: EGYPT,
  egy: EGYPT,
  egypt: EGYPT,
  sa: SAUDI,
  sau: SAUDI,
  ksa: SAUDI,
  'saudi arabia': SAUDI,
  saudi: SAUDI,
  'kingdom of saudi arabia': SAUDI,
}

export function getBenchmark(country: string | null, baseCurrency: Currency): Benchmark {
  const found = country ? ALIASES[country.trim().toLowerCase().replace(/\./g, '')] : undefined
  if (!found) return GENERIC
  return found.currency === baseCurrency ? found : { ...found, absolute: null }
}

type Basics = Pick<
  BudgetFacts,
  'household' | 'dependents' | 'supportsOthers' | 'lifestyle' | 'foodFrequency' | 'transportMode' | 'hasCar'
>

const FOOD_FREQUENCY_FACTOR: Record<NonNullable<BudgetFacts['foodFrequency']>, number> = {
  everyday: 1.5,
  mostdays: 1.2,
  sometimes: 0.8,
  rarely: 0.4,
}

const ADULTS: Record<Household, number> = { solo: 1, couple: 2, family: 2 }

/** Children eat less than adults; counted at 0.6 of a person for food and health. */
function headcount(f: Basics): number {
  return ADULTS[f.household] + f.dependents * 0.6
}

/** Monthly utilities when rent excludes them. */
export function benchmarkUtilities(b: Benchmark, f: Basics, income: number): number {
  return Math.round(b.absolute ? b.absolute.utilitiesByHousehold[f.household] : b.ratios.utilities * income)
}

/** Typical monthly spend per everyday key for this household, in base currency. */
export function benchmarkEveryday(b: Benchmark, f: Basics, income: number): Record<EverydayKey, number> {
  const a = b.absolute
  if (!a) {
    const out = {} as Record<EverydayKey, number>
    for (const k of Object.keys(b.ratios.everyday) as EverydayKey[]) out[k] = Math.round(b.ratios.everyday[k] * income)
    return out
  }
  const people = headcount(f)
  const adults = ADULTS[f.household]
  const mode: TransportMode = f.transportMode ?? (f.hasCar ? 'car' : 'public')
  const dining = a.diningPerPerson[f.lifestyle] * ADULTS[f.household] * (f.foodFrequency ? FOOD_FREQUENCY_FACTOR[f.foodFrequency] : 1)
  return {
    groceries: Math.round(a.groceriesPerPerson[f.lifestyle] * people),
    dining: Math.round(dining),
    transport: Math.round(a.transportPerHousehold[mode] * (adults > 1 ? 1.6 : 1)),
    health: Math.round(a.healthPerPerson * people),
    shopping: Math.round(a.shoppingPerPerson[f.lifestyle] * adults),
    fun: Math.round(a.funPerPerson[f.lifestyle] * adults),
    family: Math.round(f.dependents * a.perDependent + (f.supportsOthers ? a.supportingOthers : 0)),
    other: Math.round(a.phonePerAdult * adults),
  }
}
