/**
 * Core SMS parser.
 *
 * `parse(body, sender)` iterates EGYPTIAN_SMS_RULES and returns the first match.
 * Named capture groups {amount, currency, merchant} are extracted from each rule's
 * bodyPattern. Unknown groups are tolerated gracefully.
 */

import { EGYPTIAN_SMS_RULES } from '@/lib/sms/egyptianBankPatterns'
import {
  EXPENSE_TYPES,
  TYPE_TO_CATEGORY,
  type SmsTransactionType,
} from '@/lib/sms/transactionTypes'

export interface ParsedTransaction {
  type: SmsTransactionType
  amount: number
  currency: string
  merchant: string | null
  bankName: string
  badgeKey: SmsTransactionType
  /** Whether this transaction type should create an expense. */
  shouldRecord: boolean
  /** Suggested ExpenseCategory for the auto-created expense. */
  autoCategory: string
}

/**
 * Attempt to parse an inbound SMS body + sender against all known Egyptian bank patterns.
 * Returns `null` if no rule matches (unknown bank / non-financial SMS).
 */
export function parse(body: string, sender: string): ParsedTransaction | null {
  const trimmedBody = body.trim()
  const trimmedSender = sender.trim()

  for (const rule of EGYPTIAN_SMS_RULES) {
    if (!rule.senderPattern.test(trimmedSender)) continue

    const match = rule.bodyPattern.exec(trimmedBody)
    if (!match || !match.groups) continue

    const rawAmount = match.groups['amount']
    if (!rawAmount) continue

    // Parse amount: remove thousands separators, parse float.
    const amount = parseFloat(rawAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    const currency = (match.groups['currency'] ?? rule.defaultCurrency ?? 'EGP').toUpperCase()
    const merchant = match.groups['merchant']?.trim() ?? null

    const type = rule.type
    const shouldRecord = EXPENSE_TYPES.has(type)
    const autoCategory = enrichCategory(type, merchant)

    return {
      type,
      amount,
      currency,
      merchant,
      bankName: rule.bankName,
      badgeKey: type,
      shouldRecord,
      autoCategory,
    }
  }

  return null
}

/**
 * Refine the expense category based on merchant name keywords when the
 * base type maps to a broad catch-all like 'Other'.
 */
function enrichCategory(type: SmsTransactionType, merchant: string | null): string {
  const base = TYPE_TO_CATEGORY[type]

  if (!merchant || base !== 'Other') return base

  const m = merchant.toLowerCase()

  if (/uber|careem|swvl|bus|metro|taxi|lyft|bolt/i.test(m)) return 'Transport'
  if (/restaurant|cafe|coffee|food|pizza|kfc|mcd|burger|sushi|shawarma/i.test(m)) return 'Food'
  if (/supermarket|carrefour|spinney|hyper|market|grocery/i.test(m)) return 'Food'
  if (/netflix|spotify|prime|youtube|hulu|disney|gaming/i.test(m)) return 'Enjoyment'
  if (/gym|fitness|sport/i.test(m)) return 'Enjoyment'
  if (/rent|apartment|landlord|property/i.test(m)) return 'Rent'

  return base
}
