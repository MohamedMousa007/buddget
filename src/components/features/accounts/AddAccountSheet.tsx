'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ProviderPickerSheet } from '@/components/features/payments/ProviderPickerSheet'
import { ACCOUNT_CURRENCY_FIELD_CLASS, AccountIdentifierField, type Identifier } from '@/components/features/payments/accountFormParts'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { FieldButton } from '@/components/ui/FieldButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ensureCashAccount, setOpeningBalance } from '@/lib/accounts/actions'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, PAYMENT_TYPE_META, composePaymentMethodName, resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Currency } from '@/lib/store/types'
import { isSavableTail } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'
import type { AccountPrefill } from '@/lib/store/useSettingsStore'
import { BrandMark } from './BrandMark'

type Kind = 'bank_account' | 'wallet' | 'cash'

interface AddAccountSheetProps {
  open: boolean
  onClose: () => void
  initialKind?: Kind
  /** A bank account the messages already name: provider and number start filled in. */
  prefill?: AccountPrefill
  /** A bank can be followed straight by its first card: saves the account, then hands over its id. */
  onAddCard?: (accountId: string) => void
}

const COUNTRY: Partial<Record<Currency, 'EG' | 'SA' | 'AE'>> = { EGP: 'EG', SAR: 'SA', AED: 'AE' }
const BRAND_CURRENCY = { EG: 'EGP', SA: 'SAR', AE: 'AED' } as const

/** Add an account by hand: who it is with, how it is told apart, its currency and what it holds today. */
export function AddAccountSheet({ open, onClose, initialKind = 'bank_account', prefill, onAddCard }: AddAccountSheetProps) {
  const t = useT().accountsPage
  const tp = useT().paymentMethods
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const [kind, setKind] = useState<Kind>(initialKind)
  const prefillBrand = prefill ? resolvePaymentBrandKey(prefill.provider) : null
  const [brandId, setBrandId] = useState<string | null>(prefillBrand)
  const [custom, setCustom] = useState(prefill && !prefillBrand ? prefill.provider : '')
  const [balance, setBalance] = useState('')
  const [idMode, setIdMode] = useState<Identifier>(prefill ? 'last4' : 'none')
  const [last4, setLast4] = useState(prefill?.last4 ?? '')
  const [label, setLabel] = useState('')
  const prefillCountry = prefillBrand ? PAYMENT_BRANDS[prefillBrand].country : undefined
  const [currency, setCurrency] = useState<Currency>((prefill?.currency as Currency | undefined) ?? (prefillCountry && prefillCountry in BRAND_CURRENCY ? BRAND_CURRENCY[prefillCountry as keyof typeof BRAND_CURRENCY] : base))
  const [currencyChosen, setCurrencyChosen] = useState(!!prefill?.currency)
  const [pickOpen, setPickOpen] = useState(false)

  const brand = brandId ? PAYMENT_BRANDS[brandId] : null
  const provider = brand?.name ?? custom
  const isCash = kind === 'cash'
  const reattribute = useReattribute()
  const hasBalance = balance.trim() !== '' && Number.isFinite(parseFloat(balance))
  const digitsOk = idMode !== 'last4' || isSavableTail(last4)
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
    if (!canSave) return false
    const amount = parseFloat(balance)
    if (isCash) {
      const id = ensureCashAccount()
      setOpeningBalance(id, amount)
      return id
    }
    // The digits are kept whenever they were typed (SMS matching needs them), even when a label is what the user sees.
    const digits = idMode !== 'none' && last4.length > 0 && isSavableTail(last4) ? last4 : undefined
    const words = idMode === 'label' ? label.trim() : ''
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

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}><V3SheetHeader.Title>{t.addAccountTitle}</V3SheetHeader.Title></V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-3 pt-2">
          <SegmentedControl ariaLabel={t.accountType} value={kind} onChange={setKind}
            options={[{ value: 'bank_account', label: t.typeBank }, { value: 'wallet', label: t.typeWallet }, { value: 'cash', label: t.typeCash }]} />
          {!isCash ? (
            <>
              <div>
                <div className={`mx-0.5 mb-2 ${microClassName}`}>{tp.provider}</div>
                <FieldButton onClick={() => setPickOpen(true)} placeholder={t.chooseBank} value={provider || undefined}
                  icon={provider ? <BrandMark name={provider} color={brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color} size={32} /> : undefined} />
              </div>
              <AccountIdentifierField mode={idMode} onModeChange={setIdMode} allowsLast4 last4={last4} onLast4Change={setLast4} label={label} onLabelChange={setLabel} />
              <div>
                <div className="mx-0.5 mb-2 flex items-center gap-2">
                  <span className={microClassName}>{tp.currency}</span>
                  <span className="text-[0.625rem] font-medium text-[var(--color-brand-text-muted)]">{tp.optional}</span>
                </div>
                <CurrencyField value={currency} onChange={(c) => { setCurrency(c as unknown as Currency); setCurrencyChosen(true) }} className={ACCOUNT_CURRENCY_FIELD_CLASS} />
              </div>
            </>
          ) : null}
          <div>
            <div className={`mx-0.5 mb-2 ${microClassName}`}>{t.balanceToday}</div>
            <AmountField value={balance} onChange={setBalance} currency={isCash ? base : currency} placeholder="0" />
          </div>
        </div>
        <div className="space-y-2 px-5 pb-5 pt-2">
          <Button size="cta-block" onClick={() => { if (save()) onClose() }} disabled={!canSave} className="font-semibold">{t.addAccountCta}</Button>
          {kind === 'bank_account' && onAddCard ? (
            <Button variant="outline" size="cta-block" disabled={!canSave} onClick={() => { const id = save(); if (id) onAddCard(id) }}>{t.addAccountAndCard}</Button>
          ) : null}
        </div>
      </div>
      <ProviderPickerSheet open={pickOpen} selectedId={brandId} popularIds={popular} issuesType={kind === 'wallet' ? 'wallet' : 'bank_account'}
        onPick={pickProvider}
        onCustom={(term) => { setBrandId(null); setCustom(term); setPickOpen(false) }} onClose={() => setPickOpen(false)} />
    </ModalShell>
  )
}
