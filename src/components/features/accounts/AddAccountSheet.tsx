'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ProviderPickerSheet } from '@/components/features/payments/ProviderPickerSheet'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { FieldButton } from '@/components/ui/FieldButton'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/switch'
import { ensureCashAccount, setOpeningBalance } from '@/lib/accounts/actions'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, PAYMENT_TYPE_META, composePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import type { Currency } from '@/lib/store/types'
import { BrandMark } from './BrandMark'

type Kind = 'bank_account' | 'wallet' | 'cash'

interface AddAccountSheetProps {
  open: boolean
  onClose: () => void
  initialKind?: Kind
}

const COUNTRY: Partial<Record<Currency, 'EG' | 'SA' | 'AE'>> = { EGP: 'EG', SAR: 'SA', AED: 'AE' }

/** Add an account by hand: who it is with, what it holds today, and whether messages may check it. */
export function AddAccountSheet({ open, onClose, initialKind = 'bank_account' }: AddAccountSheetProps) {
  const t = useT().accountsPage
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const [kind, setKind] = useState<Kind>(initialKind)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [balance, setBalance] = useState('')
  const [last4, setLast4] = useState('')
  const [track, setTrack] = useState(true)
  const [pickOpen, setPickOpen] = useState(false)

  const brand = brandId ? PAYMENT_BRANDS[brandId] : null
  const provider = brand?.name ?? custom
  const isCash = kind === 'cash'
  const hasBalance = balance.trim() !== '' && Number.isFinite(parseFloat(balance))
  const canSave = hasBalance && (isCash || provider.trim() !== '')
  const popular = (COUNTRY[base] ? QUICK_ADD[COUNTRY[base]!] : QUICK_ADD_BLEND)

  const save = () => {
    if (!canSave) return
    const amount = parseFloat(balance)
    if (isCash) {
      setOpeningBalance(ensureCashAccount(), amount)
    } else {
      const id = addPaymentMethod({
        name: composePaymentMethodName(provider, { last4: last4.length === 4 ? last4 : undefined }),
        type: kind, currency: base, isDefault: false,
        color: brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color,
        ...(last4.length === 4 ? { last4 } : {}), trackSms: track,
      })
      setOpeningBalance(id, amount)
    }
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}><V3SheetHeader.Title>{t.addAccountTitle}</V3SheetHeader.Title></V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-3 pt-2">
          <SegmentedControl ariaLabel={t.accountType} value={kind} onChange={setKind}
            options={[{ value: 'bank_account', label: t.typeBank }, { value: 'wallet', label: t.typeWallet }, { value: 'cash', label: t.typeCash }]} />
          {!isCash ? (
            <FieldButton onClick={() => setPickOpen(true)} placeholder={t.chooseBank} value={provider || undefined}
              icon={provider ? <BrandMark name={provider} color={brand?.colors[0] ?? PAYMENT_TYPE_META[kind].color} size={32} /> : undefined} />
          ) : null}
          <div>
            <p className="mb-2 text-center text-[13px] font-semibold text-[var(--color-brand-text-secondary)]">{t.balanceToday}</p>
            <AmountField value={balance} onChange={setBalance} currency={base} placeholder="0" />
          </div>
          {!isCash ? (
            <>
              <div>
                <p className="mb-2 text-[13px] font-semibold text-[var(--color-brand-text-secondary)]">{t.last4}</p>
                <Input inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} placeholder="2016" aria-label={t.last4} />
              </div>
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.checkMessages}</span>
                  <span className="block text-[13px] text-[var(--color-brand-text-muted)]">{t.checkMessagesSub}</span>
                </span>
                <Switch checked={track} onCheckedChange={setTrack} aria-label={t.checkMessages} />
              </div>
            </>
          ) : null}
        </div>
        <div className="px-5 pb-5 pt-2">
          <Button size="cta-block" onClick={save} disabled={!canSave} className="font-semibold">{t.addAccountCta}</Button>
        </div>
      </div>
      <ProviderPickerSheet open={pickOpen} selectedId={brandId} popularIds={popular} issuesType={kind === 'wallet' ? 'wallet' : 'bank_account'}
        onPick={(id) => { setBrandId(id); setCustom(''); setPickOpen(false) }}
        onCustom={(term) => { setBrandId(null); setCustom(term); setPickOpen(false) }} onClose={() => setPickOpen(false)} />
    </ModalShell>
  )
}
