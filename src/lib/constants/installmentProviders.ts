import type { InstallmentProvider } from '@/lib/store/types'

export const INSTALLMENT_PROVIDERS = [
  {
    key: 'credit_card' as const,
    name: 'Credit Card',
    color: '#1A1A2E',
    emoji: '💳',
    initial: 'CC',
    description: 'Bank installment plan on your credit card',
  },
  {
    key: 'tabby' as const,
    name: 'Tabby',
    color: '#3BFFC1',
    emoji: '🟢',
    initial: 'T',
    description: 'Split in 4, pay over time',
  },
  {
    key: 'tamara' as const,
    name: 'Tamara',
    color: '#FF6B9D',
    emoji: '🩷',
    initial: 'Ta',
    description: 'Split your payments',
  },
  {
    key: 'other' as const,
    name: 'Other',
    color: '#6B7280',
    emoji: '📋',
    initial: '…',
    description: 'Other buy now pay later service',
  },
] as const

export function findInstallmentProviderMeta(key: InstallmentProvider | undefined) {
  if (!key) return undefined
  return INSTALLMENT_PROVIDERS.find((p) => p.key === key)
}
