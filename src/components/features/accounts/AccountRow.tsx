import type { AccountView } from '@/lib/accounts/useAccounts'
import type { PaymentMethod } from '@/lib/store/types'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { BrandMark } from './BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { CardStrip } from './CardStrip'
import { ProviderCardFaces } from './ProviderCardFaces'
import { Badge } from '@/components/ui/badge'
import { accountColor, accountDisplayName, accountSubtitle, accountTitle, moneyFlex, smartSplit, splitMoney } from './accountDisplay'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { createElement } from 'react'

interface AccountRowProps {
  account: AccountView
  masked: boolean
  /** Bank minus ledger. Negative = money is missing, positive = the bank shows more; either turns the row into an exception. */
  gap?: number
  /** Another account has the same provider: the currency moves into the subtitle where it can be read. */
  shared?: boolean
  /** A foreign-currency balance in the base currency ("≈ 4,850 EGP", or "No rate today"), under the amount. */
  baseEquivalent?: string
  onOpen: () => void
  onFix?: () => void
  /** The account holds less than what is set aside in it: the row reads "Short X" and opens the shortfall sheet. */
  onShort?: () => void
  onAddCard: () => void
  /** A face under a bank or wallet account opens that card. */
  onOpenCard?: (card: PaymentMethod) => void
}

/** One account: mark, name, balance and its cards. Only exceptions get colour. */
export function AccountRow({ account, masked, gap, shared = false, baseEquivalent, onOpen, onFix, onShort, onAddCard, onOpenCard }: AccountRowProps) {
  const dict = useT()
  const t = dict.accountsPage
  const base = useFinanceStore((s) => String(s.settings.baseCurrency))
  const { method, balance, cards } = account
  const cur = String(method.currency)
  const money = balance ? smartSplit(balance.balance, cur) : null
  const hasGap = gap != null && gap !== 0
  // LOGIC_SPEC I-3: set aside − balance; card hold-back never counts toward it.
  const short = balance ? Math.max(0, balance.held - balance.balance) : 0
  const lt = useAccountsLtCopy().short
  const isCash = method.type === 'cash'
  const isPrepaid = method.type === 'prepaid_card'
  // The user's Name leads; the line under it then carries the digits, never the Name a second time.
  const title = accountDisplayName(method)
  const idLine = accountSubtitle({ ...method, label: undefined }, shared)
  const sub = method.excluded
    ? dict.exclusion.reasonMethod
    : hasGap
    ? (gap > 0 ? t.extraFindIt : t.missingFindIt)(splitMoney(Math.abs(gap), cur).int)
    : balance
      ? isCash
        ? [t.estimateCountedByYou, idLine].filter(Boolean).join(' · ')
        // "••1234 · EGP" as the mockup's account rows read; a shared provider's line already leads with the currency.
        : (shared ? idLine : [idLine, cur].filter(Boolean).join(' · ')) || (method.type === 'wallet' ? t.typeWallet : '')
      : t.addBalanceToInclude
  return (
    <div>
      <button type="button" onClick={hasGap && onFix ? onFix : short > 0 && onShort ? onShort : onOpen} data-raw-button-ok="a whole-row tap target, sized by its content"
        className="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start" aria-label={title}>
        <BrandMark name={accountTitle(method)} color={accountColor(method)} alert={hasGap} logo={isCash ? null : bankLogoForName(accountTitle(method))}
          icon={isCash ? createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true }) : undefined} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{title}</span>
            {shared || cur === base ? null : <Badge variant="muted" size="xs" className="font-mono-numbers">{cur}</Badge>}
            {isPrepaid ? <Badge variant="muted" size="xs">{t.typePrepaid}</Badge> : null}
          </span>
          <span className={`mt-0.5 block truncate text-[0.8125rem] ${hasGap ? 'font-semibold text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]'}`}>{sub}</span>
        </span>
        <span className="shrink-0 text-end">
          {money ? (
            <>
              <span className="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
                {masked ? MASK : money.int + money.dec}
              </span>
              {!masked && short > 0 ? (
                <span dir="auto" className="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-amber)]">{lt.row(moneyFlex(short, cur))}</span>
              ) : !masked && balance && (balance.held > 0 || balance.cardHold > 0) ? (
                <span dir="auto" className="mt-0.5 block font-mono-numbers text-[0.71875rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.freeLabel(moneyFlex(balance.free, cur))}</span>
              ) : null}
              {!masked && baseEquivalent ? (
                <span dir="auto" className="mt-0.5 block whitespace-nowrap font-mono-numbers text-[0.71875rem] text-[var(--color-brand-text-muted)]">{baseEquivalent}</span>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-semibold text-[var(--color-brand-primary-ink)]">{t.setBalance}</span>
          )}
        </span>
      </button>
      {method.type === 'bank_account' || method.type === 'wallet' ? (
        <div className="px-4 pb-3.5">
          <ProviderCardFaces faces={cards.map((c) => ({ method: c, parentAccountId: method.id, isAccount: false }))} label={t.cardsCount(cards.length)}
            parentOf={() => method} onFace={(f) => (onOpenCard ? onOpenCard(f.method) : onOpen())} onAddCard={onAddCard} emptyLabel={t.addACard} />
        </div>
      ) : null}
      {isPrepaid ? <CardStrip cards={[method]} onOpen={onOpen} onAddCard={onAddCard} label={t.typePrepaid} /> : null}
    </div>
  )
}
