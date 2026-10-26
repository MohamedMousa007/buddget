import type { AccountView } from '@/lib/accounts/useAccounts'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { BrandMark } from './BrandMark'
import { CardStrip } from './CardStrip'
import { Badge } from '@/components/ui/badge'
import { accountColor, accountIdentifier, accountTitle, splitMoney } from './accountDisplay'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { createElement } from 'react'

interface AccountRowProps {
  account: AccountView
  masked: boolean
  /** Negative = money the ledger cannot explain; turns the row into an exception. */
  gap?: number
  onOpen: () => void
  onFix?: () => void
  onAddCard: () => void
}

/** One account: mark, name, balance and its cards. Only exceptions get colour. */
export function AccountRow({ account, masked, gap, onOpen, onFix, onAddCard }: AccountRowProps) {
  const dict = useT()
  const t = dict.accountsPage
  const { method, balance, cards } = account
  const cur = String(method.currency)
  const money = balance ? splitMoney(balance.balance, cur) : null
  const hasGap = gap != null && gap !== 0
  const sub = method.excluded
    ? dict.exclusion.reasonMethod
    : hasGap
    ? t.missingFindIt(splitMoney(Math.abs(gap), cur).int)
    : balance
      ? accountIdentifier(method) ?? (method.type === 'wallet' ? t.typeWallet : '')
      : t.addBalanceToInclude
  const isCash = method.type === 'cash'
  return (
    <div>
      <button type="button" onClick={hasGap && onFix ? onFix : onOpen} data-raw-button-ok="a whole-row tap target, sized by its content"
        className="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-start" aria-label={accountTitle(method)}>
        <BrandMark name={accountTitle(method)} color={accountColor(method)} alert={hasGap}
          icon={isCash ? createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true }) : undefined} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-base font-semibold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{accountTitle(method)}</span>
            <Badge variant="muted" size="xs" className="font-mono-numbers">{cur}</Badge>
          </span>
          <span className={`mt-0.5 block truncate text-[13px] ${hasGap ? 'font-semibold text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-muted)]'}`}>{sub}</span>
        </span>
        <span className="shrink-0 text-end">
          {money ? (
            <>
              <span className="block font-mono-numbers text-base font-medium tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
                {masked ? MASK : <>{money.int}<span className="opacity-45">{money.dec}</span></>}
              </span>
              {!masked && balance && balance.held > 0 ? (
                <span className="mt-0.5 block font-mono-numbers text-[11.5px] font-semibold text-[var(--color-brand-primary-ink)]">{t.freeLabel(splitMoney(balance.free, cur).int)}</span>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-semibold text-[var(--color-brand-primary-ink)]">{t.setBalance}</span>
          )}
        </span>
      </button>
      {method.type === 'bank_account' ? <CardStrip cards={cards} onOpen={onOpen} onAddCard={onAddCard} /> : null}
    </div>
  )
}
