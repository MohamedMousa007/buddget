import { accountTitle } from './accountTitle'
import { PAYMENT_BRANDS, normalizeBrandToken, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import type { PaymentMethod } from '@/lib/store/types'
import { accountTotals, type AccountView, type AccountsModel } from './useAccounts'

export type ProviderSection = 'bank' | 'wallet'

/** One card face on a provider card. A parentless prepaid card is the account itself (`isAccount`), drawn as a face. */
export interface ProviderFace {
  method: PaymentMethod
  /** The open account the card hangs under; null for a card on its own or a face that is the account. */
  parentAccountId: string | null
  isAccount: boolean
}

export interface ProviderGroup {
  /** Catalogue key, else `name:<normalised name>`. */
  key: string
  /** Catalogue name, else the first account's or card's own provider name. */
  name: string
  brandKey: string | null
  section: ProviderSection
  /** Every account of the provider, prepaid included (it counts once in the total). */
  accounts: AccountView[]
  /** Faces in order: each account's cards (a prepaid account as itself), then the provider's cards with no open parent. */
  cards: ProviderFace[]
  totalInBase: number
  heldInBase: number
  approx: boolean
  /** Accounts shown as rows: every account but a prepaid card, which is drawn as a face instead. */
  accountCount: number
  cardCount: number
}

export interface ProviderGroupsModel {
  banks: ProviderGroup[]
  wallets: ProviderGroup[]
  /** Cash keeps its own row; it is never a provider group. */
  cash: AccountView[]
  /** Pay-later plans and cards whose provider cannot be identified. Render only when non-empty. */
  otherCards: ProviderFace[]
}

type Convert = (amount: number, from: string, to: string) => number | null

const nameKey = (m: PaymentMethod): string | null => {
  const norm = normalizeBrandToken(accountTitle(m))
  return norm ? `name:${norm}` : null
}

/** The group a method belongs to by its own name: the catalogue key, else its normalised name, else its id. */
export const providerKeyOf = (m: PaymentMethod): string =>
  resolvePaymentBrandKey(accountTitle(m)) ?? nameKey(m) ?? `id:${m.id}`

const isPayLater = (m: PaymentMethod, brandKey: string | null): boolean =>
  m.type === 'bnpl' || (brandKey !== null && PAYMENT_BRANDS[brandKey]?.type === 'bnpl')

interface Draft {
  key: string
  name: string
  brandKey: string | null
  accounts: AccountView[]
  cards: ProviderFace[]
}

/**
 * Groups the Accounts model by canonical provider ("NBE" and "National Bank of Egypt" are one group). A card follows
 * its parent's group; a card with no open parent goes to its own provider, or to Other cards when that provider is
 * pay-later or not identifiable. Group totals are the tracked accounts only: credit owed never enters them.
 */
export function groupByProvider(
  model: Pick<AccountsModel, 'accounts' | 'standaloneCards'>,
  base: string,
  convert: Convert,
): ProviderGroupsModel {
  const drafts = new Map<string, Draft>()
  const draft = (key: string, brandKey: string | null, fallbackName: string): Draft => {
    let d = drafts.get(key)
    if (!d) {
      d = { key, name: brandKey ? PAYMENT_BRANDS[brandKey].name : fallbackName, brandKey, accounts: [], cards: [] }
      drafts.set(key, d)
    }
    return d
  }

  const cash: AccountView[] = []
  for (const a of model.accounts) {
    if (a.method.type === 'cash') { cash.push(a); continue }
    const brandKey = resolvePaymentBrandKey(accountTitle(a.method))
    const d = draft(providerKeyOf(a.method), brandKey, accountTitle(a.method))
    d.accounts.push(a)
    if (a.method.type === 'prepaid_card') d.cards.push({ method: a.method, parentAccountId: null, isAccount: true })
    else for (const c of a.cards) d.cards.push({ method: c, parentAccountId: a.method.id, isAccount: false })
  }

  const otherCards: ProviderFace[] = []
  for (const c of model.standaloneCards) {
    const face: ProviderFace = { method: c, parentAccountId: null, isAccount: false }
    const brandKey = resolvePaymentBrandKey(accountTitle(c))
    if (isPayLater(c, brandKey)) { otherCards.push(face); continue }
    if (brandKey) { draft(brandKey, brandKey, accountTitle(c)).cards.push(face); continue }
    const known = nameKey(c)
    const d = known ? drafts.get(known) : undefined
    if (d) d.cards.push(face)
    else otherCards.push(face)
  }

  const banks: ProviderGroup[] = []
  const wallets: ProviderGroup[] = []
  for (const d of drafts.values()) {
    const section: ProviderSection = d.accounts.length > 0
      ? (d.accounts.some((a) => a.method.type === 'wallet') ? 'wallet' : 'bank')
      : (d.brandKey && PAYMENT_BRANDS[d.brandKey].type === 'wallet' ? 'wallet' : 'bank')
    const { totalInBase, heldInBase, approx } = accountTotals(d.accounts, base, convert)
    const group: ProviderGroup = {
      ...d, section, totalInBase, heldInBase, approx,
      accountCount: d.accounts.filter((a) => a.method.type !== 'prepaid_card').length,
      cardCount: d.cards.length,
    }
    ;(section === 'wallet' ? wallets : banks).push(group)
  }
  return { banks, wallets, cash, otherCards }
}
