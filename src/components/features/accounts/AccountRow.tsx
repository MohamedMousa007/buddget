import type { AccountView } from '@/lib/accounts/useAccounts'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { BrandMark } from './BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { CardStrip } from './CardStrip'
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
  onAddCard: () => void
}

/** One account: mark, name, balance and its cards. Only exceptions get colour. */
export function AccountRow({ account, masked, gap, shared = false, baseEquivalent, onOpen, onFix, onAddCard }: AccountRowProps) {
  const dict = useT()
  const t = dict.accountsPage
  const base = useFinanceStore((s) => String(s.settings.baseCurrency))
  const { method, balance, cards } = account
  const cur = String(method.currency)
  const money = balance ? smartSplit(balance.balance, cur) : null
  const hasGap = gap != null && gap !== 0
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
      <button type="button" onClick={hasGap && onFix ? onFix : onOpen} data-raw-button-ok="a whole-row tap target, sized by its content"
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
              {!masked && balance && balance.held > 0 ? (
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
      {method.type === 'bank_account' || method.type === 'wallet' ? <CardStrip cards={cards} onOpen={onOpen} onAddCard={onAddCard} parent={method} /> : null}
      {isPrepaid ? <CardStrip cards={[method]} onOpen={onOpen} onAddCard={onAddCard} label={t.typePrepaid} /> : null}
    </div>
  )
}
