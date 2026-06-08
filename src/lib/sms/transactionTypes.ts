/**
 * SMS transaction type taxonomy and badge definitions.
 *
 * Every parsed SMS maps to one of these types, which determines:
 *   - The badge shown in Settings → Recent auto-transactions
 *   - The suggested expense category written to the expense
 *   - Whether to record the transaction (incoming transfers are informational by default)
 */

export type SmsTransactionType =
  | 'purchase'        // POS / in-store card purchase
  | 'atm_withdrawal'  // ATM cash withdrawal
  | 'online_charge'   // E-commerce / online payment
  | 'transfer_out'    // Bank wire / outgoing transfer
  | 'transfer_in'     // Incoming wire (recorded as info, not expense)
  | 'instapay_out'    // InstaPay send
  | 'instapay_in'     // InstaPay receive
  | 'wallet_out'      // Mobile wallet (Vodafone Cash, Orange Money, etc.) outgoing
  | 'wallet_in'       // Mobile wallet incoming
  | 'refund'          // Merchant refund
  | 'bill_payment'    // Utility / Fawry bill
  | 'installment'     // BNPL instalment (ValU, Sympl)
  | 'fee'             // Bank service fee / subscription charge
  | 'balance_inquiry' // Non-financial — ignored by ingest

/** Which types should generate an expense record automatically. */
export const EXPENSE_TYPES: ReadonlySet<SmsTransactionType> = new Set([
  'purchase',
  'atm_withdrawal',
  'online_charge',
  'transfer_out',
  'instapay_out',
  'wallet_out',
  'bill_payment',
  'installment',
  'fee',
])

/** Default expense category per transaction type. */
export const TYPE_TO_CATEGORY: Record<SmsTransactionType, string> = {
  purchase:        'Food',       // likely grocery/restaurant — user can re-categorise
  atm_withdrawal:  'Other',
  online_charge:   'Other',
  transfer_out:    'Other',
  transfer_in:     'Other',
  instapay_out:    'Remittance',
  instapay_in:     'Other',
  wallet_out:      'Other',
  wallet_in:       'Other',
  refund:          'Other',
  bill_payment:    'Other',
  installment:     'Debt',
  fee:             'Other',
  balance_inquiry: 'Other',
}

export interface SmsBadge {
  label: string
  /** Tailwind bg colour token — used for the badge pill. */
  color: string
  /** Emoji icon shown next to the badge label. */
  icon: string
}

/**
 * Maps Gemini `kind` values (from aiParserPrompt) to the existing SmsTransactionType
 * taxonomy, enabling badge rendering for sms_parse_log rows.
 */
export const KIND_TO_BADGE: Record<string, SmsTransactionType> = {
  purchase:             'purchase',
  online_purchase:      'online_charge',
  atm_withdrawal:       'atm_withdrawal',
  instant_transfer_out: 'instapay_out',
  instant_transfer_in:  'instapay_in',
  income:               'transfer_in',
  refund:               'refund',
  fee:                  'fee',
  other:                'purchase',
}

export const SMS_BADGES: Record<SmsTransactionType, SmsBadge> = {
  purchase:        { label: 'Purchase',      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      icon: '🛒' },
  atm_withdrawal:  { label: 'ATM',           color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '🏧' },
  online_charge:   { label: 'Online',        color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '🌐' },
  transfer_out:    { label: 'Transfer Out',  color: 'bg-red-500/20 text-red-400 border-red-500/30',          icon: '➡️' },
  transfer_in:     { label: 'Transfer In',   color: 'bg-green-500/20 text-green-400 border-green-500/30',    icon: '⬅️' },
  instapay_out:    { label: 'InstaPay Out',  color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '⚡' },
  instapay_in:     { label: 'InstaPay In',   color: 'bg-teal-500/20 text-teal-400 border-teal-500/30',       icon: '⚡' },
  wallet_out:      { label: 'Wallet Out',    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',       icon: '📱' },
  wallet_in:       { label: 'Wallet In',     color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',       icon: '📱' },
  refund:          { label: 'Refund',        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '↩️' },
  bill_payment:    { label: 'Bill Payment',  color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    icon: '🧾' },
  installment:     { label: 'Instalment',    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', icon: '📅' },
  fee:             { label: 'Bank Fee',      color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',    icon: '💳' },
  balance_inquiry: { label: 'Balance',       color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',       icon: 'ℹ️' },
}
