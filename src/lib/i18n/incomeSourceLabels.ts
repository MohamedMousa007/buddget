import type { Dictionary } from '@/lib/i18n/types'
import type { IncomeSourceType } from '@/lib/store/types'

/** Localized short label for an income `sourceType` (cards, pills, subtitles). */
export function incomeSourceTypeLabel(
  t: Dictionary['income'],
  st: IncomeSourceType | undefined
): string {
  switch (st ?? 'other') {
    case 'salary':
      return t.sourceTypeSalary
    case 'bonus':
      return t.sourceTypeBonus
    case 'side_hustle':
      return t.sourceTypeSideHustle
    case 'investment':
      return t.sourceTypeInvestment
    case 'savings':
      return t.sourceTypeSavings
    case 'debt':
      return t.sourceTypeDebt
    case 'gift':
      return t.sourceTypeGift
    case 'refund':
      return t.sourceTypeRefund
    default:
      return t.sourceTypeOther
  }
}
