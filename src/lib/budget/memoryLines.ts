import type { FinancialProfile } from '@/lib/store/types'

const A = (fp: FinancialProfile | null | undefined, k: string) => fp?.budgetProfile?.[k]
const MIN_SIGNALS = 2
const NOTICEABLE = 0.1

const LINE_NAMES: Record<string, string> = {
  groceries: 'groceries', dining: 'dining out', transport: 'transport', health: 'health', shopping: 'shopping', fun: 'fun', family: 'family', other: 'other spending',
}

/**
 * What Buddgy should remember about someone's money, derived from the synced profile every time, so it is always current
 * on every device and never duplicated or stale. Short sentences, most useful first.
 */
export function budgetMemoryLines(fp: FinancialProfile | null | undefined): string[] {
  if (!fp) return []
  const out: string[] = []
  const housing = A(fp, 'housing') ?? fp.housing
  if (housing === 'rent') out.push('Rents their home.')
  else if (housing === 'own') out.push(A(fp, 'ownType') === 'mortgage' ? 'Owns their home and still pays a mortgage.' : 'Owns their home outright.')
  else if (housing === 'family') out.push('Lives with family.')
  else if (housing === 'company') out.push('Lives in company housing.')

  const type = A(fp, 'incomeType')
  if (type === 'freelance' || type === 'business') out.push('Self-employed: income varies, so plans are sized on the slowest month and tax is set aside first.')
  else if (type === 'mixed') out.push('Has a base income plus variable earnings.')
  else if ((fp.incomeStability ?? A(fp, 'incomeStability')) === 'variable') out.push('Income varies from month to month.')
  const partner = A(fp, 'partnerRole')
  if (partner === 'shares') out.push('Shares household costs with a partner and plans only their own share.')
  if ((fp.dependents ?? 0) > 0 || Number(A(fp, 'dependents')) > 0) out.push(`Supports ${fp.dependents ?? A(fp, 'dependents')} dependant${(fp.dependents ?? Number(A(fp, 'dependents'))) === 1 ? '' : 's'}.`)
  const strategy = A(fp, 'debtStrategy')
  if (strategy === 'snowball') out.push('Pays debts smallest balance first.')
  else if (strategy === 'avalanche') out.push('Pays debts highest interest first.')
  if (A(fp, 'healthCover') === 'none') out.push('Has no health insurance.')
  if (A(fp, 'retirement') === 'none') out.push('Has no retirement saving yet.')
  const lean = fp.securityLean
  if (typeof lean === 'number') out.push(lean <= 35 ? 'Prefers to save hard over spending comfortably.' : lean >= 65 ? 'Prefers living comfortably over saving hard.' : '')
  if (Array.isArray(fp.priorities) && fp.priorities.length > 0) out.push(`Budget priorities: ${fp.priorities.join(', ')}.`)

  for (const [key, e] of Object.entries(fp.learned?.everyday ?? {})) {
    if (!e || e.n < MIN_SIGNALS || Math.abs(e.mult - 1) < NOTICEABLE) continue
    const pct = Math.round(Math.abs(e.mult - 1) * 100)
    out.push(`Usually spends about ${pct}% ${e.mult < 1 ? 'less' : 'more'} on ${LINE_NAMES[key] ?? key} than the standard estimate.`)
  }
  if ((fp.learned?.rebuilds ?? 0) >= 2) out.push('Often rebuilds the plan soon after making it, so confirm assumptions before building.')
  return out.filter(Boolean).slice(0, 12)
}
