import type { PaymentMethodType } from '@/lib/store/types'

/** Theme color for payment method row (dot / swatch). */
export function defaultColorForPaymentMethodType(
  type: PaymentMethodType,
  name?: string
): string {
  if (type === 'nol') {
    return nolAccentFromName(name ?? '')
  }
  switch (type) {
    case 'cash':
      return '#F5F5F5'
    case 'bank_transfer':
      return '#22C55E'
    case 'card_debit':
      return '#A855F7'
    case 'card_credit':
      return '#3B82F6'
    default:
      return '#9CA3AF'
  }
}

/** Accent for Nol cards: gold VIP variants vs silver default. */
export function nolAccentFromName(name: string): string {
  const n = name.toLowerCase()
  if (/gold|vip|plus|platinum|premium/.test(n)) return '#D4AF37'
  return '#C0C0C0'
}

/**
 * Stored on `PaymentMethod.icon` for list display (emoji keeps settings UI simple).
 * Maps to lucide intent: cash DollarSign, bank Building, cards CreditCard.
 */
export function defaultIconEmojiForPaymentMethodType(type: PaymentMethodType): string {
  switch (type) {
    case 'cash':
      return '💵'
    case 'bank_transfer':
      return '🏦'
    case 'card_debit':
    case 'card_credit':
      return '💳'
    case 'nol':
      return '🎫'
    default:
      return '💰'
  }
}
