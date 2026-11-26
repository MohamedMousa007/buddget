'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ProviderPickerSheet } from '@/components/features/payments/ProviderPickerSheet'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { Last4Tiles, InputRow } from '@/components/features/payments/accountFormParts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { AmountHero } from '@/components/ui/AmountHero'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ensureCashAccount, setOpeningBalance } from '@/lib/accounts/actions'
import { cashCurrency } from '@/lib/accounts/resolve'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, PAYMENT_TYPE_META, brandIssuesType, composePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import type { Currency } from '@/lib/store/types'
import { isSavableTail } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'
import type { AccountPrefill } from '@/lib/store/useSettingsStore'
import { BrandMark } from './BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { CardFaceChip } from './CardFaceChip'
import { accountIdentifier, moneyFlex } from './accountDisplay'

type Kind = 'bank_account' | 'wallet' | 'cash'

interface AddAccountSheetProps {
  open: boolean
  onClose: () => void
  initialKind?: Kind
  /** A bank account the messages already name: provider and number start filled in. */
  prefill?: AccountPrefill
  /** A bank can be followed straight by its first card: saves the account, then hands over its id. */
  onAddCard?: (accountId: string) => void
  /** "Add account and a card" saves the account and slides to its card form inside this sheet (wins over `onAddCard`). */
  pushCardStep?: boolean
  /** "Only a card, like a store card? Add a card": the card-only form instead of an account. */
  onOnlyCard?: () => void
}

type Step = 'account' | 'card' | 'done'

/** The balance typed in Add account: an empty field is the 0 its placeholder shows (a new, empty wallet); junk is null. */
export function typedOpeningBalance(text: string): number | null {
  if (text.trim() === '') return 0
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : null
}

const COUNTRY: Partial<Record<Currency, 'EG' | 'SA' | 'AE'>> = { EGP: 'EG', SAR: 'SA', AED: 'AE' }
const BRAND_CURRENCY = { EG: 'EGP', SA: 'SAR', AE: 'AED' } as const

/**
 * Add an account by hand (Light touch): Bank | Wallet, what it holds today with its currency inline, who it is with,
 * its last 4 and an optional Name (the `label` column; empty shows "Provider ••1234"), then its first card.
 */
export function AddAccountSheet({ open, onClose, initialKind = 'bank_account', prefill, onAddCard, pushCardStep = false, onOnlyCard }: AddAccountSheetProps) {
  const t = useT().accountsPage
  const tc = useT().common
  const lt = useAccountsLtCopy()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  // Cash's balance is stored in Cash's own currency, so it is asked in that currency too.
  const cashCur = useFinanceStore((s) => cashCurrency(s.paymentMethods, s.settings.baseCurrency))
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const [kind, setKind] = useState<Kind>(initialKind)
  const prefillBrand = prefill ? resolvePaymentBrandKey(prefill.provider) : null
  const [brandId, setBrandId] = useState<string | null>(prefillBrand)
  const [custom, setCustom] = useState(prefill && !prefillBrand ? prefill.provider : '')
  const [balance, setBalance] = useState('')
  const [last4, setLast4] = useState(prefill?.last4 ?? '')
  const [label, setLabel] = useState('')
  const prefillCountry = prefillBrand ? PAYMENT_BRANDS[prefillBrand].country : undefined
  const [currency, setCurrency] = useState<Currency>((prefill?.currency as Currency | undefined) ?? (prefillCountry && prefillCountry in BRAND_CURRENCY ? BRAND_CURRENCY[prefillCountry as keyof typeof BRAND_CURRENCY] : base))
  const [currencyChosen, setCurrencyChosen] = useState(!!prefill?.currency)
  const [pickOpen, setPickOpen] = useState(false)
  const [step, setStep] = useState<{ name: Step; dir: 1 | -1 }>({ name: 'account', dir: 1 })
  const [savedId, setSavedId] = useState<string | null>(null)
  const [freshCardId, setFreshCardId] = useState<string | null>(null)
  const [cardRound, setCardRound] = useState(0)
  const saved = useFinanceStore((s) => (savedId ? s.paymentMethods.find((m) => m.id === savedId) : undefined))
  const methods = useFinanceStore((s) => s.paymentMethods)
  const savedCards = useMemo(() => (savedId ? methods.filter((m) => m.parentId === savedId && !m.closedAt) : []), [methods, savedId])
  const reduceMotion = useReducedMotion()
  const go = (name: Step, dir: 1 | -1 = 1) => setStep({ name, dir })

  const brand = brandId ? PAYMENT_BRANDS[brandId] : null
  const provider = brand?.name ?? custom
  const isCash = kind === 'cash'
  const reattribute = useReattribute()
  const opening = typedOpeningBalance(balance)
  const hasBalance = opening !== null
  const digitsOk = last4 === '' || isSavableTail(last4)
  const canSave = hasBalance && digitsOk && (isCash || provider.trim() !== '')
  const popular = (COUNTRY[base] ? QUICK_ADD[COUNTRY[base]!] : QUICK_ADD_BLEND)

  const pickProvider = (id: string) => {
    const b = PAYMENT_BRANDS[id]
    setBrandId(id)
    setCustom('')
    setPickOpen(false)
    // The provider's own country sets the currency until the user picks one themselves.
    if (!currencyChosen && b.country && b.country in BRAND_CURRENCY) setCurrency(BRAND_CURRENCY[b.country as keyof typeof BRAND_CURRENCY])
  }

  /** Saves the account and returns its id; false when the form is not complete. */
  const save = (): string | false => {
    if (!canSave || opening === null) return false
    const amount = opening
    if (isCash) {
      const id = ensureCashAccount()
      setOpeningBalance(id, amount)
      return id
    }
    // The digits are kept whenever they were typed (SMS matching needs them), even when a label is what the user sees.
    const digits = last4.length > 0 && isSavableTail(last4) ? last4 : undefined
    const words = label.trim()
    const id = addPaymentMethod({
      name: composePaymentMethodName(provider, { last4: digits }),
      type: kind, currency, isDefault: false,
      color: brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color,
      ...(digits ? { last4: digits } : {}),
      ...(words ? { label: words } : {}),
    })
    setOpeningBalance(id, amount)
    if (digits) void reattribute(id, digits)
    return id
  }

  const canCard = pushCardStep ? kind !== 'cash' : kind === 'bank_account' && !!onAddCard
  const confirm = useConfirm()
  // The account is saved before its card can hang under it, so the tap asks first: nothing is written without a yes.
  const addWithCard = async () => {
    if (!canSave) return
    if (!(await confirm({ title: lt.addAccount.saveFirstTitle, body: lt.addAccount.saveFirstBody(label.trim() || provider.trim()), confirmLabel: lt.addAccount.saveFirstCta, cancelLabel: lt.addAccount.notYet }))) return
    const id = save()
    if (!id) return
    if (!pushCardStep) { onAddCard?.(id); return }
    setSavedId(id); go('card')
  }
  const name = saved ? [provider, accountIdentifier(saved)].filter(Boolean).join(' ') : provider
  const summary = saved ? (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]"><Check className="size-3.5" strokeWidth={3} /></span>
      <BrandMark name={provider} color={brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color} size={32} logo={bankLogoForName(provider)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.accountAdded(provider)}</span>
        <span className="block truncate font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{[accountIdentifier(saved), String(saved.currency), opening !== null ? moneyFlex(opening, String(saved.currency)) : null].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  ) : null

  const pickKind = (k: Kind) => {
    setKind(k)
    // The picker lists only what this kind issues: a provider that does not issue it is cleared.
    if (brand && k !== 'cash' && !brandIssuesType(brand, k)) { setBrandId(null); setCustom('') }
  }
  const defaultName = provider.trim() ? `${provider.trim()}${last4 ? ` \u2022\u2022${last4}` : ''}` : ''
  const accountStep = (
    <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}><V3SheetHeader.Title>{isCash ? lt.addAccount.cashTitle : t.addAccountTitle}</V3SheetHeader.Title></V3SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3 pt-1">
          {!isCash ? (
            <div className="px-4">
              <SegmentedControl ariaLabel={t.accountType} value={kind} onChange={pickKind}
                options={[{ value: 'bank_account', label: t.typeBank }, { value: 'wallet', label: t.typeWallet }]} />
            </div>
          ) : null}
          <AmountHero value={balance} onChange={setBalance} currency={isCash ? String(cashCur) : String(currency)} label={t.balanceToday} aria-label={t.balanceToday}
            onCurrencyChange={isCash ? undefined : (c) => { setCurrency(c as Currency); setCurrencyChosen(true) }} base={base}
            line={isCash ? '' : kind === 'wallet' ? lt.addAccount.walletLine : lt.addAccount.bankLine} />
          {!isCash ? (
            <>
              <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
                <PickerRow label={kind === 'wallet' ? t.typeWallet : t.typeBank} onClick={() => setPickOpen(true)}
                  value={provider ? (
                    <>
                      <BrandMark name={provider} color={brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color} size={24} logo={bankLogoForName(provider)} />
                      <span dir="auto" className="truncate">{provider}</span>
                    </>
                  ) : <span className="text-[var(--color-brand-text-muted)]">{lt.addAccount.choose}</span>} />
                <Last4Tiles value={last4} onChange={setLast4} optional />
                <InputRow label={t.accountName} value={label} onChange={setLabel} placeholder={defaultName || lt.addAccount.optional} />
              </Card>
              {canCard ? (
                <section>
                  <h3 className="px-5 pb-2 pt-5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{lt.addAccount.cardsHeading}</h3>
                  <Card padding="none" className="mx-4 overflow-hidden rounded-2xl">
                    <button type="button" data-raw-button-ok="the dashed Add a card empty state, a whole-row tap target" onClick={() => void addWithCard()} disabled={!canSave}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-start disabled:opacity-60">
                      <span aria-hidden className="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-text-muted)]">
                        <Plus className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.addACard}</span>
                        <span className="block text-xs text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{lt.addAccount.addCardSub}</span>
                      </span>
                    </button>
                  </Card>
                </section>
              ) : null}
              {onOnlyCard ? (
                <Button variant="link" className="mt-2 h-11 w-full whitespace-normal text-[0.8125rem]" onClick={onOnlyCard}>{t.onlyACard}</Button>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <Button size="cta-block" onClick={() => { if (save()) onClose() }} disabled={!canSave} className="font-semibold">{t.addAccountCta}</Button>
        </div>
    </div>
  )

  const cardStep = saved ? (
    <PaymentMethodSetupSheet key={cardRound} embedded open editing={null} baseCurrency={base} parentAccountId={saved.id}
      titleOverride={t.addCardTo(provider)} summary={summary} excludeTypes={['wallet', 'bnpl', 'other']}
      onBack={() => go('done', -1)} onClose={onClose}
      onSaved={(id) => { setFreshCardId(id); go('done') }} />
  ) : null

  const doneStep = saved ? (
    <div className="flex min-h-0 flex-1 flex-col">
      <V3SheetHeader onClose={onClose}><V3SheetHeader.Title>{savedCards.length > 0 ? t.cardAdded : t.accountAdded(name)}</V3SheetHeader.Title></V3SheetHeader>
      <div className="space-y-3 px-5 pb-3 pt-2">
        {summary}
        {savedCards.length > 0 ? (
          <div dir="ltr" className="native-scroll -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
            {savedCards.map((c) => (
              <motion.span key={c.id} className="shrink-0" initial={c.id === freshCardId && !reduceMotion ? { y: -14, scale: 1.06, opacity: 0 } : false}
                animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                <CardFaceChip method={c} parent={saved} />
              </motion.span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 px-5 pb-5 pt-2">
        <Button variant="outline" size="cta-block" className="flex-1" onClick={() => { setCardRound((n) => n + 1); go('card') }}>{savedCards.length > 0 ? t.addAnotherCard : t.addACard}</Button>
        <Button size="cta-block" className="flex-1 font-semibold" onClick={onClose}>{tc.done}</Button>
      </div>
    </div>
  ) : null

  const current = step.name === 'card' ? cardStep : step.name === 'done' ? doneStep : accountStep
  const slide = reduceMotion ? 0 : 36
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild panelClassName={step.name === 'card' ? 'h-[min(88dvh,760px)]' : ''}>
      <AnimatePresence mode="wait" initial={false} custom={step.dir}>
        <motion.div key={step.name === 'card' ? `card-${cardRound}` : step.name} custom={step.dir} className="flex min-h-0 flex-1 flex-col"
          variants={{ enter: (d: number) => ({ x: d * slide, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -d * slide, opacity: 0 }) }}
          initial="enter" animate="center" exit="exit" transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}>
          {current}
        </motion.div>
      </AnimatePresence>
      <ProviderPickerSheet open={pickOpen} selectedId={brandId} popularIds={popular}
        issuesType={kind === 'wallet' ? 'wallet' : 'bank_account'} customLabel={lt.addAccount.notListed}
        onPick={pickProvider}
        onCustom={(term) => { setBrandId(null); setCustom(term); setPickOpen(false) }} onClose={() => setPickOpen(false)} />
    </ModalShell>
  )
}
