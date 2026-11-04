import type { FinancialProfile, UserProfile } from '@/lib/store/types'
import type { FlowValue } from './types'

type Answers = Record<string, FlowValue>
const FREQ_DIV: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** Answers that land on the profile, so the screen can say "saved". */
export const PROFILE_ANSWERS: ReadonlySet<string> = new Set(['household', 'rent', 'rentFreq', 'rentIncludesUtilities', 'lifestyle', 'foodFrequency', 'transportMode', 'emergencyMonths', 'housing', 'dependents', 'supportsOthers', 'incomeType', 'incomeStability', 'priorities', 'securityLean', 'investing', 'cashHeavy'])

/** The answers that belong on the profile itself (so other screens and Buddgy see them), as the same patch shape the profile store takes. */
export function profilePatch(a: Answers): { profile: Partial<UserProfile>; financial: FinancialProfile } {
  const profile: Record<string, unknown> = {}
  const financial: Record<string, unknown> = {}
  const num = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : undefined)
  const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined)
  if (str('household')) profile.household = str('household')
  if (a.housing === 'rent' && num('rent') !== undefined) profile.monthlyRent = Math.round((num('rent') as number) / (FREQ_DIV[str('rentFreq') ?? 'monthly'] ?? 1))
  if (typeof a.rentIncludesUtilities === 'boolean') profile.rentIncludesUtilities = a.rentIncludesUtilities
  if (str('lifestyle')) profile.lifestyleTier = str('lifestyle')
  if (str('foodFrequency')) profile.foodFrequency = str('foodFrequency')
  if (str('transportMode')) profile.transportMode = str('transportMode')
  if (num('emergencyMonths') !== undefined) profile.emergencyFundConfig = { targetMonths: num('emergencyMonths') }
  if (str('housing')) financial.housing = str('housing')
  if (num('dependents') !== undefined) financial.dependents = num('dependents')
  if (typeof a.supportsOthers === 'boolean') financial.supportsOthers = a.supportsOthers
  const type = str('incomeType')
  if (type) financial.incomeStability = type === 'freelance' || type === 'business' || type === 'seasonal' ? 'variable' : type === 'mixed' ? 'mixed' : type === 'salary' ? (str('incomeStability') ?? 'fixed') : 'fixed'
  if (str('transportMode')) financial.hasCar = str('transportMode') === 'car'
  if (Array.isArray(a.priorities) && a.priorities.length > 0) financial.priorities = a.priorities
  if (num('securityLean') !== undefined) financial.securityLean = num('securityLean')
  if (a.investing === 'already' || a.investing === 'want_to') financial.investInterest = true
  if (typeof a.cashHeavy === 'boolean') financial.cashHeavy = a.cashHeavy
  return { profile: profile as Partial<UserProfile>, financial: financial as FinancialProfile }
}
