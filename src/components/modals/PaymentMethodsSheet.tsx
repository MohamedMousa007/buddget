'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ArrowLeft, Plus, Search, ChevronDown, Check, Pencil, Star, Trash2,
} from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { PaymentCardCarousel, shade, cardGradient, TypeGlyph } from '@/components/features/payments/PaymentCardCarousel'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { currencyFlag, currencyName } from '@/lib/constants/currencyMeta'
import {
  PAYMENT_TYPE_META, SETUP_TYPES, PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, CARD_COLORS,
  allowsLast4, composePaymentMethodName, decomposePaymentMethodName,
} from '@/lib/payment/paymentMethodDefaults'
import { cn } from '@/lib/utils'
import type { Currency, PaymentMethod, PaymentMethodType } from '@/lib/store/types'

type Disc = 'last4' | 'tag' | 'none'

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}
function countryFromCurrency(cur: Currency): 'EG' | 'SA' | 'AE' | null {
  if (cur === 'EGP') return 'EG'
  if (cur === 'SAR') return 'SA'
  if (cur === 'AED') return 'AE'
  return null
}

export function PaymentMethodsSheet() {
  const t = useT()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const deletePaymentMethod = useFinanceStore((s) => s.deletePaymentMethod)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { activeModal, setActiveModal, pmPrefill, clearPmPrefill } = useSettingsStore()

  const isWalletModal = activeModal === 'paymentMethods'
  const isAddModal = activeModal === 'addPaymentMethod'
  const isOpen = isWalletModal || isAddModal

  const [screen, setScreen] = useState<'wallet' | 'setup'>('wallet')
  const [active, setActive] = useState(0)
  const [cardMenuId, setCardMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // setup fields
  const [brandId, setBrandId] = useState<string | null>(null)
  const [providerName, setProviderName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('bank_account')
  const [disc, setDisc] = useState<Disc>('none')
  const [last4, setLast4] = useState('')
  const [tag, setTag] = useState('')
  const [curCode, setCurCode] = useState<Currency>(baseCurrency)
  const [cardColor, setCardColor] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)

  const [providerSheetOpen, setProviderSheetOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)

  const prevOpen = useRef(false)
  const appliedPrefill = useRef<unknown>(null)

  const resetSetup = (initialCur: Currency) => {
    setBrandId(null); setProviderName(''); setType('bank_account'); setDisc('none')
    setLast4(''); setTag(''); setCurCode(initialCur); setCardColor(null); setIsDefault(false)
    setEditingId(null)
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync sheet state to the modal entry point on open */
    if (isOpen && !prevOpen.current) {
      setCardMenuId(null); setProviderSheetOpen(false); setCurrencyOpen(false)
      if (isAddModal) {
        resetSetup(baseCurrency)
        setScreen('setup')
        if (pmPrefill && appliedPrefill.current !== pmPrefill) {
          appliedPrefill.current = pmPrefill
          setProviderName(pmPrefill.name)
          setLast4(pmPrefill.last4)
          setType('bank_account')
          setDisc(pmPrefill.last4 ? 'last4' : 'none')
        }
      } else {
        setScreen('wallet')
        setActive(0)
      }
    }
    prevOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, isAddModal, baseCurrency, pmPrefill])

  const close = () => {
    clearPmPrefill()
    appliedPrefill.current = null
    setActiveModal(null)
  }
  useEscapeClose(isOpen, close)

  // ── wallet deck (cash is implicit — never a card) ─────────────────────────
  const deck = useMemo(() => paymentMethods.filter((m) => m.type !== 'cash'), [paymentMethods])

  const openEdit = (m: PaymentMethod) => {
    const { provider, tag: decTag } = decomposePaymentMethodName(m.name, m.last4)
    setEditingId(m.id)
    setBrandId(null)
    setProviderName(provider)
    setType(m.type)
    setLast4(m.last4 ?? '')
    setTag(decTag)
    setDisc(m.last4 ? 'last4' : decTag ? 'tag' : 'none')
    setCurCode(m.currency)
    setCardColor(m.color ?? null)
    setIsDefault(m.isDefault)
    setCardMenuId(null)
    setScreen('setup')
  }

  const pickBrand = (id: string) => {
    const b = PAYMENT_BRANDS[id]
    const cur: Currency = id === 'nol' ? 'AED'
      : b.country === 'SA' ? 'SAR' : b.country === 'AE' ? 'AED' : b.country === 'EG' ? 'EGP' : curCode
    setBrandId(id)
    setProviderName(b.name)
    setType(b.type)
    setDisc(allowsLast4(b.type) ? (b.type === 'prepaid_card' ? 'none' : 'last4') : 'none')
    setCardColor(null)
    setCurCode(cur)
    setProviderSheetOpen(false)
  }

  const pickType = (v: PaymentMethodType) => {
    setType(v)
    if (disc === 'last4' && !allowsLast4(v)) setDisc('none')
  }

  const setCustomProvider = (term: string) => {
    setBrandId('__custom')
    setProviderName(term.trim())
    setProviderSheetOpen(false)
  }

  const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
  const primaryColor = cardColor || (brand ? brand.colors[0] : null)
  const effectiveColor = primaryColor || PAYMENT_TYPE_META[type].color
  const hasProvider = providerName.trim().length > 0
  const canSave = hasProvider && !(disc === 'last4' && last4.length !== 0 && last4.length !== 4)

  const handleSave = () => {
    if (!canSave) return
    const provider = providerName.trim()
    const use4 = disc === 'last4' && last4.length === 4
    const useTag = disc === 'tag' && tag.trim().length > 0
    const name = composePaymentMethodName(provider, {
      last4: use4 ? last4 : undefined,
      tag: useTag ? tag : undefined,
    })
    const payload = {
      name,
      type,
      currency: curCode,
      color: effectiveColor,
      isDefault,
      ...(use4 ? { last4 } : {}),
    }
    if (editingId) {
      updatePaymentMethod(editingId, { ...payload, last4: use4 ? last4 : undefined })
    } else {
      addPaymentMethod(payload)
      setActive(deck.length) // new non-cash card is appended last
    }
    setScreen('wallet')
    clearPmPrefill()
    appliedPrefill.current = null
  }

  // ── popular set (derived from base currency; no country switcher) ──────────
  const country = countryFromCurrency(baseCurrency)
  const popularIds = country ? QUICK_ADD[country] : QUICK_ADD_BLEND

  const menuCard = deck.find((m) => m.id === cardMenuId) ?? null

  return (
    <>
      <ModalShell open={isOpen} onBackdropClick={close} scrollChild>
        <div className="relative flex min-h-0 flex-1 flex-col outline-none">
          {screen === 'wallet' ? (
            // ══════════════ WALLET ══════════════
            <>
              <div className="flex shrink-0 items-center justify-between px-[18px] pb-2 pt-1">
                <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
                  {t.paymentMethods.title}
                </span>
                <button
                  type="button" onClick={close} aria-label="Close"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
                >
                  <X className="h-full w-full" />
                </button>
              </div>

              {deck.length === 0 ? (
                <div className="flex h-[224px] items-center justify-center px-8 text-center text-sm text-[var(--color-brand-text-muted)]">
                  {t.paymentMethods.emptyHint}
                </div>
              ) : (
                <PaymentCardCarousel
                  methods={deck}
                  active={active}
                  onActiveChange={setActive}
                  defaultLabel={t.paymentMethods.default}
                  hint={t.paymentMethods.walletHint}
                  onMenu={setCardMenuId}
                />
              )}

              <div className="shrink-0 px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
                <button
                  type="button"
                  onClick={() => { resetSetup(baseCurrency); setScreen('setup') }}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--color-brand-red)] text-base font-semibold text-white"
                >
                  <Plus className="h-5 w-5" />
                  {t.paymentMethods.addMethod}
                </button>
              </div>

              {menuCard && (
                <>
                  <button
                    type="button" aria-label="Close menu"
                    onClick={() => setCardMenuId(null)}
                    className="absolute inset-0 z-30 cursor-default"
                  />
                  <div
                    className="absolute end-[44px] top-[92px] z-[31] w-[200px] overflow-hidden rounded-[14px] border border-[#34343f] bg-[#1E1E28]"
                    style={{ boxShadow: '0 18px 44px -10px rgba(0,0,0,.7)' }}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] py-2 pe-1.5 ps-3">
                      <span className="truncate text-[11.5px] font-semibold text-[var(--color-brand-text-muted)]">
                        {decomposePaymentMethodName(menuCard.name, menuCard.last4).provider}
                        {menuCard.last4 ? ` ••••${menuCard.last4}` : ''}
                      </span>
                      <button
                        type="button" aria-label="Close" onClick={() => setCardMenuId(null)}
                        className="flex h-[26px] w-[26px] items-center justify-center p-1.5 text-[var(--color-brand-text-muted)]"
                      >
                        <X className="h-full w-full" />
                      </button>
                    </div>
                    <button
                      type="button" onClick={() => openEdit(menuCard)}
                      className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-white"
                    >
                      <Pencil className="h-[17px] w-[17px] text-[#CFCFE0]" />
                      {t.paymentMethods.edit}
                    </button>
                    {!menuCard.isDefault && (
                      <>
                        <div className="h-px bg-[var(--color-brand-border)]" />
                        <button
                          type="button"
                          onClick={() => { updatePaymentMethod(menuCard.id, { isDefault: true }); setCardMenuId(null) }}
                          className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-white"
                        >
                          <Star className="h-[17px] w-[17px] fill-[#38D96B] text-[#38D96B]" />
                          {t.paymentMethods.setDefault}
                        </button>
                      </>
                    )}
                    <div className="h-px bg-[var(--color-brand-border)]" />
                    <button
                      type="button"
                      onClick={() => {
                        deletePaymentMethod(menuCard.id)
                        setCardMenuId(null)
                        setActive(0)
                      }}
                      className="flex w-full items-center gap-[11px] px-3.5 py-3 text-start text-sm font-medium text-[#FF6B6B]"
                    >
                      <Trash2 className="h-[17px] w-[17px]" />
                      {t.paymentMethods.delete}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            // ══════════════ SETUP ══════════════
            <>
              <div className="flex shrink-0 items-center gap-2.5 px-4 pb-3 pt-1">
                <button
                  type="button" aria-label="Back"
                  onClick={() => { setScreen('wallet'); setProviderSheetOpen(false); setCurrencyOpen(false) }}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
                >
                  <ArrowLeft className="h-full w-full" />
                </button>
                <span className="min-w-0 flex-1 text-lg font-semibold text-[var(--color-brand-text-primary)]">
                  {editingId ? t.paymentMethods.editTitle : t.paymentMethods.addTitle}
                </span>
                <button
                  type="button" aria-label="Close" onClick={close}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
                >
                  <X className="h-full w-full" />
                </button>
              </div>

              <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {/* Live card preview */}
                <div className="mb-4 mt-0.5 flex justify-center">
                  <div
                    className="relative flex flex-col overflow-hidden rounded-[20px]"
                    style={{
                      width: 262, height: 164, padding: '18px 20px',
                      background: hasProvider ? cardGradient(effectiveColor) : '#161620',
                      border: hasProvider ? 'none' : '1px dashed #33333f',
                      boxShadow: hasProvider ? `0 20px 44px -16px ${shade(effectiveColor, 0.5)}` : 'none',
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px]"
                      style={{ background: 'radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.16), transparent 60%)' }}
                    />
                    <div className="relative flex items-center justify-between">
                      <span
                        className="flex h-8 w-[44px] shrink-0 items-center justify-center rounded-lg p-[7px] text-white"
                        style={{ background: hasProvider ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)' }}
                      >
                        {hasProvider ? <TypeGlyph type={type} className="h-full w-full" /> : <Plus className="h-full w-full" />}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80">
                        {hasProvider ? PAYMENT_TYPE_META[type].label : t.paymentMethods.newMethod}
                      </span>
                    </div>
                    <div className="relative mt-auto text-start">
                      <div
                        className="truncate text-[22px] font-bold tracking-[-0.01em]"
                        style={{ color: hasProvider ? '#fff' : 'rgba(255,255,255,.45)' }}
                      >
                        {hasProvider ? providerName : t.paymentMethods.addTitle}
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <span className="font-mono-numbers text-[15px] font-semibold tracking-[0.16em] text-white/90">
                          {disc === 'last4'
                            ? (last4 ? `••••  ${last4}` : '••••  ••••')
                            : disc === 'tag' && tag.trim() ? tag.trim() : '——  ——'}
                        </span>
                        <span className="font-mono-numbers text-[13px] font-bold text-white/85">{curCode}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card colour */}
                <div className="mb-5">
                  <div className="mx-0.5 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                    {t.paymentMethods.cardColour}
                  </div>
                  <div className="native-scroll flex gap-2.5 overflow-x-auto px-0.5 pb-1">
                    {CARD_COLORS.map((c) => {
                      const activeSw = (cardColor || (brand ? brand.colors[0] : null)) === c
                      return (
                        <button
                          key={c} type="button" onClick={() => setCardColor(c)} aria-label={`Colour ${c}`}
                          className="h-[34px] w-[34px] shrink-0 rounded-[10px]"
                          style={{
                            background: c,
                            border: `2px solid ${activeSw ? '#fff' : 'transparent'}`,
                            boxShadow: '0 0 0 1px rgba(255,255,255,.12)',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Provider — popular grid + search all */}
                <div className="mb-5">
                  <div className="mx-0.5 mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                    {t.paymentMethods.popularOptions}
                  </div>
                  <div className="mb-3 grid grid-cols-4 gap-2.5">
                    {popularIds.slice(0, 8).map((id) => {
                      const b = PAYMENT_BRANDS[id]
                      const col = b.colors[0]
                      const sel = brandId === id
                      return (
                        <button
                          key={id} type="button" onClick={() => pickBrand(id)}
                          className="flex h-[74px] flex-col items-center gap-[7px] rounded-[13px] p-2 px-1"
                          style={{
                            background: sel ? rgba(col, 0.14) : 'var(--color-brand-elevated)',
                            border: `1px solid ${sel ? rgba(col, 0.5) : 'var(--color-brand-border)'}`,
                          }}
                        >
                          <span
                            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-extrabold"
                            style={{ background: rgba(col, 0.18), color: col }}
                          >
                            {b.short}
                          </span>
                          <span className="max-w-full truncate text-[10.5px] font-semibold text-[var(--color-brand-text-secondary)]">
                            {b.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button" onClick={() => setProviderSheetOpen(true)}
                    className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[13.5px] font-semibold text-[var(--color-brand-text-secondary)]"
                  >
                    <Search className="h-4 w-4" />
                    {t.paymentMethods.searchAll}
                  </button>
                </div>

                <div className="flex flex-col gap-[17px]">
                  {/* Type */}
                  <div>
                    <div className="mx-0.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                      {t.paymentMethods.type}
                    </div>
                    <div className="native-scroll flex gap-1.5 overflow-x-auto pb-0.5">
                      {SETUP_TYPES.map((tp) => {
                        const meta = PAYMENT_TYPE_META[tp]
                        const activeChip = type === tp
                        return (
                          <button
                            key={tp} type="button" onClick={() => pickType(tp)}
                            className="flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold"
                            style={{
                              background: activeChip ? rgba(meta.color, 0.15) : 'var(--color-brand-elevated)',
                              border: `1px solid ${activeChip ? rgba(meta.color, 0.5) : 'var(--color-brand-border)'}`,
                              color: activeChip ? meta.color : 'var(--color-brand-text-muted)',
                            }}
                          >
                            <TypeGlyph type={tp} className="h-[15px] w-[15px]" />
                            {meta.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Identifier */}
                  <div>
                    <div className="mx-0.5 mb-2 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                        {t.paymentMethods.identifier}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">
                        {t.paymentMethods.optional}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {(allowsLast4(type) ? (['last4', 'tag', 'none'] as Disc[]) : (['tag', 'none'] as Disc[])).map((k) => {
                        const selTab = disc === k
                        const label = k === 'last4' ? t.paymentMethods.fourDigits : k === 'tag' ? t.paymentMethods.label : t.paymentMethods.none
                        return (
                          <button
                            key={k} type="button" onClick={() => setDisc(k)}
                            className={cn(
                              'h-11 flex-1 rounded-xl border text-[13px] font-semibold',
                              selTab
                                ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)] text-white'
                                : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {disc === 'last4' && (
                      <>
                        <input
                          value={last4}
                          onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          dir="ltr" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="e.g. 1234"
                          className="mt-2.5 h-[52px] w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 font-mono-numbers text-[15px] tracking-[0.1em] text-[var(--color-brand-text-primary)] text-start outline-none"
                        />
                        <div className="mt-2 px-0.5 text-[11.5px] text-[var(--color-brand-text-muted)]">
                          {t.paymentMethods.last4Help}
                        </div>
                      </>
                    )}
                    {disc === 'tag' && (
                      <input
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        maxLength={18} placeholder={t.paymentMethods.tagPlaceholder}
                        className="mt-2.5 h-[52px] w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] text-start outline-none"
                      />
                    )}
                  </div>

                  {/* Currency */}
                  <div>
                    <div className="mx-0.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                      {t.paymentMethods.currency}
                    </div>
                    <button
                      type="button" onClick={() => setCurrencyOpen(true)}
                      className="flex h-[52px] w-full items-center justify-between rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5"
                    >
                      <span className="flex items-center gap-[11px]">
                        <span className="text-[22px] leading-none">{currencyFlag(curCode)}</span>
                        <span className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-text-primary)]">{curCode}</span>
                        <span className="text-[13px] font-medium text-[var(--color-brand-text-muted)]">{currencyName(curCode)}</span>
                      </span>
                      <ChevronDown className="h-[15px] w-[15px] text-[var(--color-brand-text-muted)]" />
                    </button>
                  </div>

                  {/* Set as default */}
                  <div className="flex items-center justify-between rounded-[14px] border border-[#24242f] bg-[#16161f] px-4 py-3.5">
                    <span className="text-start">
                      <span className="block text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                        {t.paymentMethods.setDefault}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-[var(--color-brand-text-muted)]">
                        {t.paymentMethods.setDefaultSub}
                      </span>
                    </span>
                    <button
                      type="button" role="switch" aria-checked={isDefault}
                      onClick={() => setIsDefault((v) => !v)}
                      className="flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors"
                      style={{ background: isDefault ? '#E50914' : 'var(--color-brand-border)', justifyContent: isDefault ? 'flex-end' : 'flex-start' }}
                    >
                      <span className="block h-[22px] w-[22px] rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-[#1c1c26] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button" onClick={handleSave} disabled={!canSave}
                  className={cn(
                    'h-[52px] w-full rounded-[14px] text-base font-semibold',
                    canSave
                      ? 'bg-[var(--color-brand-red)] text-white'
                      : 'cursor-not-allowed bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]',
                  )}
                >
                  {t.paymentMethods.saveMethod}
                </button>
              </div>
            </>
          )}
        </div>
      </ModalShell>

      <ProviderPickerSheet
        open={providerSheetOpen}
        selectedId={brandId}
        popularIds={popularIds}
        onPick={pickBrand}
        onCustom={setCustomProvider}
        onClose={() => setProviderSheetOpen(false)}
      />

      <CurrencySheet
        open={currencyOpen}
        value={curCode}
        base={baseCurrency}
        zIndexClassName="z-[120]"
        onSelect={(code) => { setCurCode(code as Currency); setCurrencyOpen(false) }}
        onClose={() => setCurrencyOpen(false)}
      />
    </>
  )
}

// ── Provider picker sheet ─────────────────────────────────────────────────
function ProviderPickerSheet({
  open, selectedId, popularIds, onPick, onCustom, onClose,
}: {
  open: boolean
  selectedId: string | null
  popularIds: string[]
  onPick: (id: string) => void
  onCustom: (term: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  useEscapeClose(open, onClose)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const ids = Object.keys(PAYMENT_BRANDS)
    if (q) {
      const hits = ids.filter((id) => {
        const b = PAYMENT_BRANDS[id]
        return (`${b.name} ${b.full ?? ''}`).toLowerCase().includes(q)
      })
      return hits.map((id) => ({ kind: 'item' as const, id }))
    }
    const rest = ids.filter((id) => !popularIds.includes(id))
    return [
      { kind: 'header' as const, label: t.paymentMethods.popularOptions },
      ...popularIds.map((id) => ({ kind: 'item' as const, id })),
      { kind: 'header' as const, label: t.paymentMethods.allProviders },
      ...rest.map((id) => ({ kind: 'item' as const, id })),
    ]
  }, [query, popularIds, t])

  const customLabel = query.trim()
    ? t.paymentMethods.addCustomNamed.replace('{q}', query.trim())
    : t.paymentMethods.addCustom

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="lg:w-[420px]">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="flex shrink-0 items-center justify-between pb-3 pt-1">
          <span className="text-lg font-semibold text-[var(--color-brand-text-primary)]">
            {t.paymentMethods.chooseProvider}
          </span>
          <button
            type="button" aria-label="Close" onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
          >
            <X className="h-full w-full" />
          </button>
        </div>
        <div className="relative mb-2.5 shrink-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.paymentMethods.searchProviderPlaceholder}
            className="h-11 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] ps-10 pe-3 text-[15px] text-[var(--color-brand-text-primary)] text-start outline-none"
          />
        </div>
        <div className="native-scroll -mx-1 flex max-h-[52vh] min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {rows.map((r, i) => {
            if (r.kind === 'header') {
              return (
                <div key={`h-${r.label}-${i}`} className="px-1.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-text-muted)]">
                  {r.label}
                </div>
              )
            }
            const b = PAYMENT_BRANDS[r.id]
            const col = b.colors[0]
            const sel = selectedId === r.id
            return (
              <button
                key={`${r.id}-${i}`} type="button" onClick={() => onPick(r.id)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-start',
                  sel ? 'border border-[var(--color-brand-red)]/40 bg-[var(--color-brand-red)]/10' : 'border border-transparent',
                )}
              >
                <span
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-[12px] font-extrabold"
                  style={{ background: rgba(col, 0.18), color: col }}
                >
                  {b.short}
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-[14.5px] font-semibold text-[var(--color-brand-text-primary)]">{b.name}</span>
                  <span className="block text-[11px] font-medium text-[var(--color-brand-text-muted)]">
                    {PAYMENT_TYPE_META[b.type].label}{b.full ? ` · ${b.full}` : ''}
                  </span>
                </span>
                {sel && <Check className="h-[18px] w-[18px] shrink-0 text-[var(--color-brand-red)]" />}
              </button>
            )
          })}
        </div>
        <button
          type="button" onClick={() => onCustom(query)}
          className="mt-2.5 flex h-[50px] w-full shrink-0 items-center justify-center gap-2 rounded-[13px] border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red)]/10 text-sm font-semibold text-[#FF5C5C]"
        >
          <Plus className="h-[18px] w-[18px]" />
          {customLabel}
        </button>
      </div>
    </ModalShell>
  )
}
