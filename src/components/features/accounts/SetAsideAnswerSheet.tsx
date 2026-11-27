'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Clock, Receipt, TriangleAlert } from 'lucide-react'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { PocketTile } from '@/components/features/savings-v3/MoneySheetParts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useActionToast } from '@/components/ui/ActionToast'
import { answerSetAsideMoney, closeAccount, heldIn } from '@/lib/accounts/actions'
import { computeBalances } from '@/lib/accounts/balance'
import { canHoldParts } from '@/lib/accounts/kinds'
import { useAccounts, useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
import { uncoverOrder } from '@/lib/savings/labels'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { prefillDestination, shortfallEpisodes } from '@/lib/savings/shortfall'
import { settlePrompt } from '@/lib/prompts/settle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useLocale, useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { accountColor, accountDisplayName, accountTitle, moneyFlex } from './accountDisplay'
import { BrandMark } from './BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'

type Choice = 'acct' | 'spent' | 'keep'

const MUTED = 'text-[var(--color-brand-text-muted)]'
const SECOND = 'text-[var(--color-brand-text-secondary)]'

function IconTile({ children }: { children: ReactNode }) {
  return <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-brand-elevated)] ${SECOND}`}>{children}</span>
}

function ChoiceList({ label, value, onChange, items }: { label: string; value: Choice; onChange: (c: Choice) => void; items: [Choice, ReactNode, string, string][] }) {
  return (
    <>
      <h3 className={`${microClassName} px-1 pt-1`}>{label}</h3>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
        {items.map(([k, icon, title, sub]) => (
          <SelectableCard key={k} selected={value === k} onClick={() => onChange(k)} className="min-h-[60px]">
            <IconTile>{icon}</IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
              <span className={`mt-0.5 block text-xs leading-snug ${SECOND}`}>{sub}</span>
            </span>
          </SelectableCard>
        ))}
      </div>
    </>
  )
}

function DestinationList({ label, accounts, value, onChange, hint }: { label: string; accounts: AccountView[]; value: string; onChange: (id: string) => void; hint?: { id: string; text: string } }) {
  return (
    <>
      <h3 className={`${microClassName} px-1 pt-1`}>{label}</h3>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
        {accounts.map(({ method }) => (
          <SelectableCard key={method.id} selected={value === method.id} onClick={() => onChange(method.id)} className="min-h-[60px]">
            <BrandMark name={accountTitle(method)} color={accountColor(method)} size={36} logo={bankLogoForName(accountTitle(method))} />
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">
                {accountDisplayName(method)}{method.last4 ? <span dir="ltr" className={`font-mono-numbers ${MUTED}`}> {'••'}{method.last4}</span> : null}
              </span>
              {hint?.id === method.id ? <span className="mt-0.5 block text-xs font-semibold leading-snug text-[var(--color-brand-primary-ink)]">{hint.text}</span> : null}
            </span>
          </SelectableCard>
        ))}
      </div>
    </>
  )
}

/** The accounts the money can now be in: live ones that can hold set-aside money, the just-paired destination first. */
function useDestinations(account: PaymentMethod) {
  const { accounts } = useAccounts()
  const ledger = useLedgerInput()
  const prefill = useMemo(() => prefillDestination(ledger, account.id), [ledger, account.id])
  const list = useMemo(() => {
    const ok = accounts.filter((a) => a.method.id !== account.id && canHoldParts(a.method))
    return prefill ? [...ok.filter((a) => a.method.id === prefill.accountId), ...ok.filter((a) => a.method.id !== prefill.accountId)] : ok
  }, [accounts, account.id, prefill])
  return { list, prefill }
}

interface Props {
  account: PaymentMethod
  onClose: () => void
  zClassName?: string
}

/**
 * "CIB is short 2,400" (LOGIC_SPEC §4.2, mockup acc_short): the account holds less than what is set aside in it. Each
 * answer applies to what is still short and the sheet stays open on the rest until it is covered or kept for now.
 */
export function ShortfallSheet({ account, onClose, zClassName = 'z-[110]' }: Props) {
  const all = useT()
  const c = useAccountsLtCopy().short
  const { locale } = useLocale()
  const toast = useActionToast()
  const ledger = useLedgerInput()
  const goals = useFinanceStore((s) => s.goals)
  const sf = all.savingsForms
  const cur = String(account.currency)
  const name = accountDisplayName(account)
  const balance = useMemo(() => computeBalances(ledger).get(account.id) ?? { balance: 0, held: 0 }, [ledger, account.id])
  const short = Math.max(0, balance.held - balance.balance)
  const { list, prefill } = useDestinations(account)
  const [choice, setChoice] = useState<Choice>(list.length ? 'acct' : 'spent')
  const [to, setTo] = useState(prefill?.accountId ?? list[0]?.method.id ?? '')
  const [stuck, setStuck] = useState(false)
  const ordered = uncoverOrder(ledger.savingsAccounts, account.id, goals).filter((p) => p.currentBalance > 0)
  const money = (n: number) => moneyFlex(n, cur)
  const toName = list.find((a) => a.method.id === to)?.method

  const confirm = () => {
    if (choice === 'keep') {
      const ep = shortfallEpisodes(ledger).find((e) => e.accountId === account.id)
      if (ep) settlePrompt(ep.key)
      toast(c.kept)
      return onClose()
    }
    const left = answerSetAsideMoney(account.id, choice === 'acct' ? { kind: 'move', toId: to } : { kind: 'spent' }, short)
    if (left > 0.005) return setStuck(true)
    toast(choice === 'acct' ? c.moved : c.markedSpent)
    onClose()
  }

  const names = ordered.slice(0, 2).map((p) => pocketDisplayName(p, sf.systemNames))
  const cta = choice === 'acct' ? c.moveCta(toName ? accountDisplayName(toName) : '') : choice === 'spent' ? c.spentCta(money(short)) : c.keep
  return (
    <SheetFrame open onClose={onClose} title={c.title(name, money(short))} zClassName={zClassName}
      footer={<Button size="cta-block" disabled={short <= 0 || (choice === 'acct' && !toName)} onClick={confirm}>{cta}</Button>}>
      <Card className="rounded-2xl p-4">
        <p className="flex gap-2.5 text-[0.9375rem] leading-snug text-[var(--color-brand-text-primary)]">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-amber)]" />
          <span dir="auto">{c.line(money(short), name)}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2">
            <span className={`block ${MUTED}`}>{c.inAccount(name)}</span>
            <b className="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(balance.balance)}</b>
          </span>
          <span className="rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2">
            <span className={`block ${MUTED}`}>{c.setAsideThere}</span>
            <b className="mt-0.5 block font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(balance.held)}</b>
          </span>
        </div>
      </Card>
      <ChoiceList label={c.whatHappened} value={choice} onChange={(k) => { setChoice(k); setStuck(false) }} items={[
        ...(list.length ? [['acct', <ArrowLeftRight key="a" className="size-[18px]" />, c.inAnother, c.inAnotherSub(money(short))] as [Choice, ReactNode, string, string]] : []),
        ['spent', <Receipt key="s" className="size-[18px]" />, c.spent, names.length ? c.spentSub(names[0], names[1]) : ''],
        ['keep', <Clock key="k" className="size-[18px]" />, c.keep, c.keepSub(money(short))],
      ]} />
      {choice === 'acct' ? (
        <DestinationList label={c.whereNow} accounts={list} value={to} onChange={(id) => { setTo(id); setStuck(false) }}
          hint={prefill ? { id: prefill.accountId, text: c.transferHint(moneyFlex(prefill.amount, prefill.currency), name, formatLocalized(new Date(prefill.at), 'MMM d', locale)) } : undefined} />
      ) : null}
      {stuck && toName ? <p role="alert" className="text-sm text-[var(--color-brand-amber)]">{c.stillShort(money(short), accountDisplayName(toName))}</p> : null}
      <p className={`px-1 text-xs leading-relaxed ${MUTED}`}>{c.footnote}</p>
    </SheetFrame>
  )
}

/**
 * "Where did this money go?" before closing an account that holds set-aside money (LOGIC_SPEC §4.8, I-14, mockup
 * acc_close). Afterwards the account holds nothing set aside and closes.
 */
export function CloseAccountMoneySheet({ account, onClose, onClosed, zClassName = 'z-[110]' }: Props & { onClosed: () => void }) {
  const all = useT()
  const c = useAccountsLtCopy().short
  const removed = useAccountsLtCopy().removed
  const toast = useActionToast()
  const ledger = useLedgerInput()
  const goals = useFinanceStore((s) => s.goals)
  const sf = all.savingsForms
  const cur = String(account.currency)
  const name = accountDisplayName(account)
  const parts = uncoverOrder(ledger.savingsAccounts, account.id, goals).filter((p) => p.currentBalance > 0)
  const held = parts.reduce((n, p) => n + p.currentBalance, 0)
  const { list, prefill } = useDestinations(account)
  const [choice, setChoice] = useState<Choice>(list.length ? 'acct' : 'spent')
  const [to, setTo] = useState(prefill?.accountId ?? list[0]?.method.id ?? '')
  const [stuck, setStuck] = useState<'left' | 'refused' | null>(null)
  const money = (n: number) => moneyFlex(n, cur)
  const toName = list.find((a) => a.method.id === to)?.method

  const confirm = () => {
    const left = answerSetAsideMoney(account.id, choice === 'acct' ? { kind: 'move', toId: to } : { kind: 'spent' }, heldIn(account.id))
    if (left > 0.005) return setStuck('left')
    if (!closeAccount(account.id)) return setStuck('refused')
    toast(removed.accountClosed(name))
    onClosed()
  }

  return (
    <SheetFrame open onClose={onClose} title={c.closeTitle} subtitle={c.closeSub(name, money(held))} zClassName={zClassName}
      footer={<Button size="cta-block" variant="destructive-solid" disabled={choice === 'acct' && !toName} onClick={confirm}>{c.closeCta(name)}</Button>}>
      <Card padding="none" divide className="overflow-hidden rounded-2xl">
        {parts.map((p) => (
          <div key={p.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
            <PocketTile account={p} className="size-8 rounded-[10px]" iconClassName="size-4" />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{pocketDisplayName(p, sf.systemNames)}</span>
            <span className="font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{money(p.currentBalance)}</span>
          </div>
        ))}
      </Card>
      <ChoiceList label={c.beforeCloses(name)} value={choice} onChange={(k) => { setChoice(k); setStuck(null) }} items={[
        ...(list.length ? [['acct', <ArrowLeftRight key="a" className="size-[18px]" />, c.inAnother, c.closeMoveSub] as [Choice, ReactNode, string, string]] : []),
        ['spent', <Receipt key="s" className="size-[18px]" />, c.spent, c.closeSpentSub],
      ]} />
      {choice === 'acct' ? <DestinationList label={c.whereNow} accounts={list} value={to} onChange={(id) => { setTo(id); setStuck(null) }} /> : null}
      {stuck ? (
        <p role="alert" className="text-sm text-[var(--color-brand-amber)]">
          {stuck === 'left' && choice === 'acct' && toName ? c.closeLeft(money(heldIn(account.id)), accountDisplayName(toName)) : c.closeRefused(name)}
        </p>
      ) : null}
      <p className={`px-1 text-xs leading-relaxed ${MUTED}`}>{c.closeFootnote}</p>
    </SheetFrame>
  )
}
