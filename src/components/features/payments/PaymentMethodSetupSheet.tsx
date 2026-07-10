'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowLeft, Plus, Search, ChevronDown, Check, CreditCard } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { cardGradient, TypeGlyph } from '@/components/features/payments/PaymentCardCarousel'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { currencyFlag, currencyName } from '@/lib/constants/currencyMeta'
import {
  PAYMENT_TYPE_META, SETUP_TYPES, PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, CARD_COLORS,
  allowsLast4, providerInitials, composePaymentMethodName, decomposePaymentMethodName,
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

interface Props {
  open: boolean
  editing: PaymentMethod | null
  prefill?: { name: string; last4: string } | null
  baseCurrency: Currency
  onClose: () => void
  onSaved?: (id: string) => void
  /** Stack above another sheet (e.g. the picker). Bumps z-indices. */
  nested?: boolean
}

/**
 * Add / edit a payment method — floating live card preview (pinned above the
 * sheet) + provider field + colour slider + type/identifier/currency/default.
 * Reused by the wallet sheet and the payment-method picker (self-contained add).
 */
export function PaymentMethodSetupSheet({
  open, editing, prefill, baseCurrency, onClose, onSaved, nested = false,
}: Props) {
  const t = useT()
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)

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
  useEscapeClose(open && !providerSheetOpen && !currencyOpen, onClose)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initialise form when the sheet opens */
    if (open && !prevOpen.current) {
      setProviderSheetOpen(false); setCurrencyOpen(false)
      if (editing) {
        const { provider, tag: decTag } = decomposePaymentMethodName(editing.name, editing.last4)
        setBrandId(null); setProviderName(provider); setType(editing.type)
        setLast4(editing.last4 ?? ''); setTag(decTag)
        setDisc(editing.last4 ? 'last4' : decTag ? 'tag' : 'none')
        setCurCode(editing.currency); setCardColor(editing.color ?? null); setIsDefault(editing.isDefault)
      } else {
        setBrandId(null); setProviderName(prefill?.name ?? ''); setType('bank_account')
        setLast4(prefill?.last4 ?? ''); setTag('')
        setDisc(prefill?.last4 ? 'last4' : 'none')
        setCurCode(baseCurrency); setCardColor(null); setIsDefault(false)
      }
    }
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing, prefill, baseCurrency])

  const pickBrand = (id: string) => {
    const b = PAYMENT_BRANDS[id]
    const cur: Currency = id === 'nol' ? 'AED'
      : b.country === 'SA' ? 'SAR' : b.country === 'AE' ? 'AED' : b.country === 'EG' ? 'EGP' : curCode
    setBrandId(id); setProviderName(b.name); setType(b.type)
    setDisc(allowsLast4(b.type) ? (b.type === 'prepaid_card' ? 'none' : 'last4') : 'none')
    setCardColor(null); setCurCode(cur); setProviderSheetOpen(false)
  }
  const pickType = (v: PaymentMethodType) => {
    setType(v)
    if (disc === 'last4' && !allowsLast4(v)) setDisc('none')
  }
  const setCustomProvider = (term: string) => {
    setBrandId('__custom'); setProviderName(term.trim()); setProviderSheetOpen(false)
  }

  const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
  const effectiveColor = cardColor || (brand ? brand.colors[0] : null) || PAYMENT_TYPE_META[type].color
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
    const payload = { name, type, currency: curCode, color: effectiveColor, isDefault, ...(use4 ? { last4 } : {}) }
    if (editing) {
      updatePaymentMethod(editing.id, { ...payload, last4: use4 ? last4 : undefined })
      onSaved?.(editing.id)
    } else {
      onSaved?.(addPaymentMethod(payload))
    }
    onClose()
  }

  const country = countryFromCurrency(baseCurrency)
  const popularIds = country ? QUICK_ADD[country] : QUICK_ADD_BLEND

  const z = nested
    ? { shell: 'z-[120]', provider: 'z-[130]', currency: 'z-[140]' }
    : { shell: 'z-[110]', provider: 'z-[120]', currency: 'z-[130]' }

  // provider-field chip (empty = muted card glyph; selected = brand initials)
  const fieldChipColor = brand ? brand.colors[0] : '#9898B0'
  const fieldInitials = brand ? brand.short : providerInitials(providerName)

  const previewTail = disc === 'last4'
    ? (last4 ? `••••  ${last4}` : '••••  ••••')
    : disc === 'tag' && tag.trim() ? tag.trim() : '——  ——'

  return (
    <>
      <FloatingCardPreview
        open={open} z={z.shell}
        hasProvider={hasProvider} color={effectiveColor} type={type}
        name={hasProvider ? providerName : t.paymentMethods.addTitle}
        typeLabel={PAYMENT_TYPE_META[type].label}
        tail={previewTail} curCode={curCode}
      />

      <ModalShell open={open} onBackdropClick={onClose} scrollChild zIndexClassName={z.shell} panelClassName="h-[64vh]">
        <div className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex shrink-0 items-center gap-2.5 px-4 pb-3 pt-1">
            <button
              type="button" aria-label="Back" onClick={onClose}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
            >
              <ArrowLeft className="h-full w-full" />
            </button>
            <span className="min-w-0 flex-1 text-lg font-semibold text-[var(--color-brand-text-primary)]">
              {editing ? t.paymentMethods.editTitle : t.paymentMethods.addTitle}
            </span>
            <button
              type="button" aria-label="Close" onClick={onClose}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] p-[9px] text-[var(--color-brand-text-muted)]"
            >
              <X className="h-full w-full" />
            </button>
          </div>

          <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col gap-[18px]">
              {/* Provider */}
              <div>
                <div className="mx-0.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                  {t.paymentMethods.provider}
                </div>
                <button
                  type="button" onClick={() => setProviderSheetOpen(true)}
                  className="flex h-[50px] w-full items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"
                >
                  <span
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-extrabold"
                    style={hasProvider
                      ? { background: rgba(fieldChipColor, 0.16), color: fieldChipColor }
                      : { background: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
                  >
                    {hasProvider ? fieldInitials : <CreditCard className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-start text-[14.5px] font-semibold',
                      hasProvider ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-text-muted)]',
                    )}
                  >
                    {hasProvider ? providerName : t.paymentMethods.providerPlaceholder}
                  </span>
                  <ChevronDown className="h-[15px] w-[15px] shrink-0 text-[var(--color-brand-text-muted)]" />
                </button>
              </div>

              {/* Card colour */}
              <div>
                <div className="mx-0.5 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                  {t.paymentMethods.cardColour}
                </div>
                <div className="native-scroll flex gap-2.5 overflow-x-auto px-0.5 pb-1">
                  {CARD_COLORS.map((c) => {
                    const activeSw = effectiveColor === c
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
        </div>
      </ModalShell>

      <ProviderPickerSheet
        open={open && providerSheetOpen}
        selectedId={brandId}
        popularIds={popularIds}
        zIndexClassName={z.provider}
        onPick={pickBrand}
        onCustom={setCustomProvider}
        onClose={() => setProviderSheetOpen(false)}
      />

      <CurrencySheet
        open={open && currencyOpen}
        value={curCode}
        base={baseCurrency}
        zIndexClassName={z.currency}
        onSelect={(code) => { setCurCode(code as Currency); setCurrencyOpen(false) }}
        onClose={() => setCurrencyOpen(false)}
      />
    </>
  )
}

// ── Floating card preview (pinned above the sheet, static/elevated) ───────────
function FloatingCardPreview({
  open, z, hasProvider, color, type, name, typeLabel, tail, curCode,
}: {
  open: boolean
  z: string
  hasProvider: boolean
  color: string
  type: PaymentMethodType
  name: string
  typeLabel: string
  tail: string
  curCode: string
}) {
  if (typeof document === 'undefined') return null

  // Always a live, coloured card (reflects colour/type/digits/currency immediately).
  // Static 3D treatment — no motion after the one-time entrance.
  const cardShadow = `0 36px 64px -16px rgba(0,0,0,.72), 0 16px 32px -12px ${rgba(color, 0.5)}, inset 0 1px 0 rgba(255,255,255,.2)`

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="pm-float-card"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn('pointer-events-none fixed left-1/2 w-[280px]', z)}
          // Centred in the space above the 58vh sheet; floor keeps it clear of the status bar.
          style={{ top: 'max(46px, calc(21vh - 88px))', marginLeft: -140 }}
        >
          {/* halo — static coloured glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              inset: -34, borderRadius: 46,
              background: `radial-gradient(circle, ${rgba(color, 0.72)}, transparent 68%)`,
              filter: 'blur(36px)', zIndex: 0,
            }}
          />
          {/* contact shadow — static ellipse beneath the card */}
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: '50%', bottom: -20, transform: 'translateX(-50%)',
              width: 224, height: 30, background: 'rgba(0,0,0,.55)',
              borderRadius: '50%', filter: 'blur(20px)', zIndex: 0,
            }}
          />
          {/* card — static, subtle lift */}
          <div
            className="relative flex h-[176px] w-[280px] flex-col overflow-hidden rounded-[20px]"
            style={{
              padding: '19px 21px',
              background: cardGradient(color),
              boxShadow: cardShadow,
              transform: 'translateY(-2px)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[20px]"
              style={{ background: 'radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.16), transparent 60%)' }}
            />
            <div className="relative flex items-center justify-between">
              <span className="flex h-8 w-[44px] shrink-0 items-center justify-center rounded-lg bg-white/20 p-[7px] text-white">
                <TypeGlyph type={type} className="h-full w-full" />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80">{typeLabel}</span>
            </div>
            <div className="relative mt-auto text-start">
              <div
                className="truncate text-[23px] font-bold tracking-[-0.01em]"
                style={{ color: hasProvider ? '#fff' : 'rgba(255,255,255,.55)' }}
              >
                {name}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="font-mono-numbers text-[15px] font-semibold tracking-[0.16em] text-white/90">{tail}</span>
                <span className="font-mono-numbers text-[13px] font-bold text-white/85">{curCode}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Provider picker sheet ─────────────────────────────────────────────────
function ProviderPickerSheet({
  open, selectedId, popularIds, zIndexClassName, onPick, onCustom, onClose,
}: {
  open: boolean
  selectedId: string | null
  popularIds: string[]
  zIndexClassName: string
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
      const hits = ids.filter((id) => (`${PAYMENT_BRANDS[id].name} ${PAYMENT_BRANDS[id].full ?? ''}`).toLowerCase().includes(q))
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
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName} panelClassName="lg:w-[420px]">
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
                className="flex min-h-14 w-full items-center gap-3 rounded-[14px] border px-3 py-2 text-start"
                style={sel
                  ? { background: 'rgba(56,217,107,.12)', borderColor: 'rgba(56,217,107,.45)' }
                  : { borderColor: 'transparent' }}
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
                {sel && <Check className="h-[18px] w-[18px] shrink-0 text-[#38D96B]" />}
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
