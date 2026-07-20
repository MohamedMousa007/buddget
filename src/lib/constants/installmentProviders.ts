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

/**
 * Country-aware brand catalogue for installment / BNPL providers across the three
 * target markets. Cosmetic + defaulting only — the plan's economics (fixed total,
 * count, frequency) come from the user, never from per-provider financial logic.
 * The chosen brand persists as free text (`Debt.installmentProviderName`); the coarse
 * `installmentProvider` enum is derived via `coarseProvider` for legacy compatibility.
 * Shariaa: no rates, fees, or APR are modelled here.
 */
export type ProviderCategory = 'bnpl_short' | 'installment_long' | 'bank_epp' | 'other'
export type ProviderCountry = 'SA' | 'AE' | 'EG'

export interface InstallmentProviderBrand {
  slug: string
  name: string
  category: ProviderCategory
  countries: ProviderCountry[]
  color: string
  emoji: string
  defaultFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
}

export const INSTALLMENT_PROVIDER_CATALOGUE: InstallmentProviderBrand[] = [
  { slug: 'tabby', name: 'Tabby', category: 'bnpl_short', countries: ['SA', 'AE'], color: '#3BFFC1', emoji: '🟢', defaultFrequency: 'monthly' },
  { slug: 'tamara', name: 'Tamara', category: 'bnpl_short', countries: ['SA', 'AE'], color: '#FF6B9D', emoji: '🩷', defaultFrequency: 'monthly' },
  { slug: 'postpay', name: 'Postpay', category: 'bnpl_short', countries: ['AE'], color: '#2D6CDF', emoji: '🔵', defaultFrequency: 'monthly' },
  { slug: 'cashew', name: 'Cashew', category: 'bnpl_short', countries: ['AE'], color: '#E8A33D', emoji: '🥜', defaultFrequency: 'monthly' },
  { slug: 'spotii', name: 'Spotii', category: 'bnpl_short', countries: ['AE', 'SA'], color: '#7B61FF', emoji: '🟣', defaultFrequency: 'monthly' },
  { slug: 'mispay', name: 'MisPay', category: 'bnpl_short', countries: ['SA'], color: '#0EA5A5', emoji: '🟩', defaultFrequency: 'monthly' },
  { slug: 'valu', name: 'valU', category: 'installment_long', countries: ['EG'], color: '#00A88E', emoji: '🟢', defaultFrequency: 'monthly' },
  { slug: 'sympl', name: 'Sympl', category: 'bnpl_short', countries: ['EG'], color: '#111827', emoji: '⚫', defaultFrequency: 'monthly' },
  { slug: 'souhoola', name: 'Souhoola', category: 'installment_long', countries: ['EG'], color: '#F04E37', emoji: '🟠', defaultFrequency: 'monthly' },
  { slug: 'aman', name: 'Aman', category: 'installment_long', countries: ['EG'], color: '#1E88E5', emoji: '🔷', defaultFrequency: 'monthly' },
  { slug: 'contact', name: 'Contact', category: 'installment_long', countries: ['EG'], color: '#6D28D9', emoji: '🟪', defaultFrequency: 'monthly' },
  { slug: 'halan', name: 'MNT-Halan', category: 'installment_long', countries: ['EG'], color: '#F59E0B', emoji: '🟡', defaultFrequency: 'monthly' },
  { slug: 'shahry', name: 'Shahry', category: 'installment_long', countries: ['EG'], color: '#0891B2', emoji: '🩵', defaultFrequency: 'monthly' },
  { slug: 'forsa', name: 'Forsa', category: 'installment_long', countries: ['EG'], color: '#DB2777', emoji: '💗', defaultFrequency: 'monthly' },
  { slug: 'bank_epp', name: 'Bank plan', category: 'bank_epp', countries: ['SA', 'AE', 'EG'], color: '#1A1A2E', emoji: '🏦', defaultFrequency: 'monthly' },
  { slug: 'other', name: 'Other', category: 'other', countries: ['SA', 'AE', 'EG'], color: '#6B7280', emoji: '📋', defaultFrequency: 'monthly' },
]

/** Map a catalogue brand slug to the coarse client enum for legacy fields. */
export function coarseProvider(slug: string | undefined): InstallmentProvider {
  if (slug === 'tabby' || slug === 'tamara') return slug
  if (slug === 'bank_epp') return 'credit_card'
  return 'other'
}

export function findProviderBrand(slug: string | undefined): InstallmentProviderBrand | undefined {
  if (!slug) return undefined
  return INSTALLMENT_PROVIDER_CATALOGUE.find((p) => p.slug === slug)
}

/** Brands available in a market; `other`/`bank_epp` are universal. */
export function providersForCountry(country: ProviderCountry): InstallmentProviderBrand[] {
  return INSTALLMENT_PROVIDER_CATALOGUE.filter((p) => p.countries.includes(country))
}
