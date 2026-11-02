'use client'

import { ModalTitle } from '@/components/modals/ModalTitle'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowLeft, CreditCard, Lock, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { ACCOUNT_CURRENCY_FIELD_CLASS, AccountIdentifierField, type Identifier } from '@/components/features/payments/accountFormParts'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { ColorSwatchRow } from '@/components/ui/ColorSwatchRow'
import { Switch } from '@/components/ui/switch'
import { cardGradient, TypeGlyph } from '@/components/features/payments/PaymentCardCarousel'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ProviderPickerSheet } from '@/components/features/payments/ProviderPickerSheet'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { cardDayError, parseCardDay } from '@/lib/debts/cardTerms'
import {
  PAYMENT_TYPE_META, CARD_SETUP_TYPES, PAYMENT_BRANDS, QUICK_ADD, QUICK_ADD_BLEND, asCardType,
  allowsLast4, providerInitials, composePaymentMethodName, decomposePaymentMethodName,
  resolvePaymentBrandKey, prefillPaymentType, typesForBrand,
} from '@/lib/payment/paymentMethodDefaults'
import { cn } from '@/lib/utils'
import type { PmPrefill } from '@/lib/store/useSettingsStore'
import { rgba } from '@/lib/utils/color'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Currency, PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { FieldButton } from '@/components/ui/FieldButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { isSavableTail } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'

/** Banks, wallets and cash have their own sheet; this one only adds cards, and edits an account's look, never its kind. */
const CARD_TYPES: PaymentMethodType[] = ['debit_card', 'credit_card', 'prepaid_card']
function countryFromCurrency(cur: Currency): 'EG' | 'SA' | 'AE' | null {
  if (cur === 'EGP') return 'EG'
  if (cur === 'SAR') return 'SA'
  if (cur === 'AED') return 'AE'
  return null
}

interface Props {
  open: boolean
  editing: PaymentMethod | null
  prefill?: PmPrefill | null
  baseCurrency: Currency
  onClose: () => void
  onSaved?: (id: string) => void
  /** Stack above another sheet (e.g. the picker). Bumps z-indices. */
  nested?: boolean
  /** Lock the type (e.g. the Debt tab opens this locked to `credit_card`). */
  lockType?: PaymentMethodType
  /** Override the sheet title (e.g. "Add credit card" from the Debt tab). */
  titleOverride?: string
  /** New methods hang under this account (a card added from an account's page). */
  parentAccountId?: string
  /** Edit mode only: shows a destructive footer button; the caller owns confirmation and removal. */
  onDelete?: () => void
  deleteLabel?: string
}

/**
 * Add / edit a payment method — floating live card preview (pinned above the
 * sheet) + provider field + colour slider + type/identifier/currency/default.
 * Reused by the wallet sheet and the payment-method picker (self-contained add).
 */
export function PaymentMethodSetupSheet({
  open, editing, prefill, baseCurrency, onClose, onSaved, nested = false, lockType, titleOverride, parentAccountId, onDelete, deleteLabel,
}: Props) {
  const t = useT()
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const updateDebt = useFinanceStore((s) => s.updateDebt)

  const [brandId, setBrandId] = useState<string | null>(null)
  const [providerName, setProviderName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('debit_card')
  const [idMode, setIdMode] = useState<Identifier>('none')
  const [last4, setLast4] = useState('')
  const [label, setLabel] = useState('')
  const [curCode, setCurCode] = useState<Currency>(baseCurrency)
  const [cardColor, setCardColor] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [providerSheetOpen, setProviderSheetOpen] = useState(false)
  // Credit-card debt terms (only when type === 'credit_card').
  const [ccLimit, setCcLimit] = useState('')
  const [ccOutstanding, setCcOutstanding] = useState('')
  const [ccStatementDay, setCcStatementDay] = useState('')
  const [ccGrace, setCcGrace] = useState('55')

  const prevOpen = useRef(false)
  useEscapeClose(open && !providerSheetOpen, onClose)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initialise form when the sheet opens */
    if (open && !prevOpen.current) {
      setProviderSheetOpen(false)
      if (editing) {
        const { provider, tag: decTag } = decomposePaymentMethodName(editing.name, editing.last4)
        // A label an older version folded into the name ("CIB · Salary") is shown as the label it always was.
        const savedLabel = editing.label ?? decTag
        setBrandId(null); setProviderName(provider); setType(editing.type)
        setLast4(editing.last4 ?? ''); setLabel(savedLabel)
        setIdMode(savedLabel ? 'label' : editing.last4 ? 'last4' : 'none')
        setCurCode(editing.currency); setCardColor(editing.color ?? null); setIsDefault(editing.isDefault)
        // Load the linked credit-card debt's terms so they're editable here.
        const linked = useFinanceStore.getState().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === editing.id)
        setCcLimit(linked?.creditLimit != null ? String(linked.creditLimit) : '')
        setCcOutstanding(linked?.startingBalance ? String(linked.startingBalance) : '')
        setCcStatementDay(linked?.paymentDueDay != null ? String(linked.paymentDueDay) : '')
        setCcGrace(linked?.gracePeriodDays != null ? String(linked.gracePeriodDays) : '55')
      } else {
        setCcLimit(''); setCcOutstanding(''); setCcStatementDay(''); setCcGrace('55')
        const parent = parentAccountId ? useFinanceStore.getState().paymentMethods.find((m) => m.id === parentAccountId) : undefined
        if (parent) {
          // A card added under an account starts as that account's debit card: same bank, currency and colour.
          const parentBrandId = resolvePaymentBrandKey(accountTitle(parent))
          setBrandId(parentBrandId); setProviderName(accountTitle(parent))
          setType('debit_card'); setLast4(''); setLabel(''); setIdMode('none')
          setCurCode(parent.currency); setCardColor(parent.color ?? null); setIsDefault(false)
        } else {
          // Resolve a detected bank/provider name to a catalogue brand so the SMS
          // prefill lands on the right type/colours. An explicit prefill type (the SMS said
          // "Debit Card") beats the brand's default (QNB's brand type is bank_account), and a
          // bank account is added as the debit card it issues, since accounts have their own sheet.
          const pfBrandId = prefill?.name ? resolvePaymentBrandKey(prefill.name) : null
          const pfBrand = pfBrandId ? PAYMENT_BRANDS[pfBrandId] : null
          // ...except for a wallet brand — see prefillPaymentType.
          const pfType = asCardType(prefillPaymentType(prefill?.type, pfBrand))
          setBrandId(pfBrandId); setProviderName(pfBrand?.name ?? prefill?.name ?? '')
          setType(pfType)
          setLast4(prefill?.last4 ?? ''); setLabel('')
          // Same guard as pickBrand/pickType: a type that takes no last4 (wallet,
          // bnpl) must not land on the last4 identifier — the tab row wouldn't
          // even offer it, and handleSave would persist a last4 anyway.
          setIdMode(prefill?.last4 && allowsLast4(pfType) ? 'last4' : 'none')
          const suggestedParent = prefill?.parentId ? useFinanceStore.getState().paymentMethods.find((m) => m.id === prefill.parentId) : undefined
          setCurCode(suggestedParent?.currency ?? baseCurrency); setCardColor(null); setIsDefault(false)
        }
      }
      if (lockType) setType(lockType)
    }
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing, prefill, baseCurrency, lockType, parentAccountId])

  const pickBrand = (id: string) => {
    const b = PAYMENT_BRANDS[id]
    const cur: Currency = id === 'nol' ? 'AED'
      : b.country === 'SA' ? 'SAR' : b.country === 'AE' ? 'AED' : b.country === 'EG' ? 'EGP' : curCode
    // A locked context (Add credit card) wins over the brand's primary type: picking
    // a bank there means "the credit card this bank issues", not a bank account.
    const t = typeLock ?? asCardType(b.type)
    setBrandId(id); setProviderName(b.name); setType(t)
    // Stored-value types keep the last4 field available but do not default to it: a
    // prepaid card may be unnumbered, and only some wallets issue a card at all.
    const storedValue = t === 'prepaid_card' || t === 'wallet'
    setIdMode(allowsLast4(t) && !storedValue ? 'last4' : 'none')
    setCardColor(null); setCurCode(cur); setProviderSheetOpen(false)
  }
  // Types the chosen provider can plausibly issue (a bank offers account + cards,
  // Tabby only BNPL). Custom providers keep the full list. The current type is always
  // included so an existing method can never render with no matching chip.
  const offeredTypes = useMemo(() => {
    const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
    const allowed = typesForBrand(brand)
    return CARD_SETUP_TYPES.filter((t) => allowed.includes(t) || t === type)
  }, [brandId, type])

  const pickType = (v: PaymentMethodType) => {
    setType(v)
    if (idMode === 'last4' && !allowsLast4(v)) setIdMode('none')
  }
  const setCustomProvider = (term: string) => {
    setBrandId('__custom'); setProviderName(term.trim()); setProviderSheetOpen(false)
  }

  const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
  const effectiveColor = cardColor || (brand ? brand.colors[0] : null) || PAYMENT_TYPE_META[type].color
  const reattribute = useReattribute()
  const hasProvider = providerName.trim().length > 0
  // The Debt tab locks the type; an existing bank account or wallet keeps its kind here (cards are the only thing this sheet can switch between).
  const typeLock: PaymentMethodType | undefined = lockType ?? (editing && !CARD_TYPES.includes(editing.type) ? editing.type : undefined)
  const dayInvalid = type === 'credit_card' && cardDayError(ccStatementDay)
  const canSave = hasProvider && !dayInvalid && (idMode !== 'last4' || isSavableTail(last4))

  const handleSave = () => {
    if (!canSave) return
    const provider = providerName.trim()
    // The digits survive a switch to Label: SMS matching reads them even when a label is what the user sees.
    const use4 = idMode !== 'none' && last4.length > 0 && isSavableTail(last4)
    const words = idMode === 'label' ? label.trim() : ''
    const name = composePaymentMethodName(provider, { last4: use4 ? last4 : undefined })
    const payload = { name, type, currency: curCode, color: effectiveColor, isDefault, ...(use4 ? { last4 } : {}), ...(words ? { label: words } : {}) }
    let pmId: string
    if (editing) {
      updatePaymentMethod(editing.id, { ...payload, last4: use4 ? last4 : undefined, label: words || undefined })
      pmId = editing.id
    } else {
      // A credit_card PM auto-creates its linked credit-card debt in the store.
      const parentId = parentAccountId ?? (type === 'debit_card' ? prefill?.parentId : undefined)
      pmId = addPaymentMethod(parentId ? { ...payload, parentId } : payload)
    }
    // Persist the credit-card terms onto the linked credit-card debt.
    if (type === 'credit_card') {
      const linked = useFinanceStore.getState().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pmId)
      if (linked) {
        const num = (s: string) => (s.trim() === '' ? undefined : parseFloat(s))
        updateDebt(linked.id, {
          creditLimit: num(ccLimit),
          startingBalance: num(ccOutstanding) ?? linked.startingBalance,
          paymentDueDay: parseCardDay(ccStatementDay) ?? undefined,
          gracePeriodDays: ccGrace.trim() ? parseInt(ccGrace, 10) : undefined,
        })
      }
    }
    if (use4) void reattribute(pmId, last4)
    onSaved?.(pmId)
    onClose()
  }

  const country = countryFromCurrency(baseCurrency)
  const popularIds = country ? QUICK_ADD[country] : QUICK_ADD_BLEND

  // `card` sits ABOVE the shell + provider backdrops so the floating preview
  // stays crisp and in front of the sheets (not dimmed behind their scrims).
  // It stays BELOW `currency` — picking a currency is a focused sub-task that
  // may cover the card. The provider sheet is height-capped (see below) so its
  // panel never rises into the card's zone.
  const z = nested
    ? { shell: 'z-[120]', provider: 'z-[130]', card: 'z-[135]', currency: 'z-[140]' }
    : { shell: 'z-[110]', provider: 'z-[120]', card: 'z-[125]', currency: 'z-[130]' }

  // provider-field chip (empty = muted card glyph; selected = brand initials)
  const fieldChipColor = brand ? brand.colors[0] : '#9898B0'
  const fieldInitials = brand ? brand.short : providerInitials(providerName)

  const previewTail = idMode === 'label' && label.trim()
    ? label.trim()
    : idMode !== 'none' && last4 ? `••  ${last4}` : idMode === 'last4' ? '••  ••••' : '——  ——'

  const previewProps = {
    hasProvider, color: effectiveColor, type,
    name: hasProvider ? providerName : t.paymentMethods.addTitle,
    typeLabel: PAYMENT_TYPE_META[type].label,
    tail: previewTail, curCode,
  }

  return (
    <>
      <FloatingCardPreview open={open} z={z.card} {...previewProps} />

      <ModalShell open={open} onBackdropClick={onClose} scrollChild zIndexClassName={z.shell} panelClassName="h-[64dvh]">
        <div className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex shrink-0 items-center gap-2.5 px-4 pb-3 pt-1">
            {/* Debt context (lockType) follows the debt-sheet rule: X + swipe only, no Back. */}
            {!lockType ? (
              <IconButton
                aria-label={t.common.back} onClick={onClose}
                variant="tinted" size="sm" shape="round"
              >
                <ArrowLeft />
              </IconButton>
            ) : null}
            <ModalTitle className="min-w-0 flex-1 font-semibold text-[var(--color-brand-text-primary)]">
              {editing ? t.paymentMethods.editTitle : (titleOverride ?? t.paymentMethods.addTitle)}
            </ModalTitle>
            <IconButton
              aria-label={t.common.close} onClick={onClose}
              variant="tinted" size="sm" shape="round"
            >
              <X />
            </IconButton>
          </div>

          <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col gap-[18px]">
              <FloatingCardPreview open={open} inline {...previewProps} />
              {/* Provider */}
              <div>
                <div className={`mx-0.5 mb-2 ${microClassName}`}>
                  {t.paymentMethods.provider}
                </div>
                <FieldButton
                  onClick={() => setProviderSheetOpen(true)}
                  size="lg"
                  className="bg-[var(--color-brand-elevated)] px-3"
                  valueClassName="text-[14.5px] font-semibold"
                  value={hasProvider ? providerName : undefined}
                  placeholder={t.paymentMethods.providerPlaceholder}
                  icon={
                    <span
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-extrabold"
                      style={hasProvider
                        ? { background: rgba(fieldChipColor, 0.16), color: fieldChipColor }
                        : { background: 'var(--color-brand-border)', color: 'var(--color-brand-text-muted)' }}
                    >
                      {hasProvider ? fieldInitials : <CreditCard className="h-4 w-4" />}
                    </span>
                  }
                />
              </div>

              {/* Type — locked to a single chip when lockType is set (e.g. Debt → credit card) */}
              <div>
                <div className={`mx-0.5 mb-2 ${microClassName}`}>
                  {t.paymentMethods.type}
                </div>
                {typeLock ? (
                  <div
                    className="flex h-[38px] w-fit items-center gap-[7px] rounded-full px-3.5 text-[13px] font-semibold"
                    style={{
                      background: rgba(PAYMENT_TYPE_META[typeLock].color, 0.15),
                      border: `1px solid ${rgba(PAYMENT_TYPE_META[typeLock].color, 0.5)}`,
                      color: PAYMENT_TYPE_META[typeLock].color,
                    }}
                  >
                    <TypeGlyph type={typeLock} className="h-[15px] w-[15px]" />
                    {PAYMENT_TYPE_META[typeLock].label}
                    <Lock className="h-3.5 w-3.5 opacity-70" />
                  </div>
                ) : (
                  <div className="native-scroll flex gap-1.5 overflow-x-auto pb-0.5">
                    {offeredTypes.map((tp) => {
                      const meta = PAYMENT_TYPE_META[tp]
                      const activeChip = type === tp
                      return (
                        <OptionChip
                          key={tp} selected={activeChip} onClick={() => pickType(tp)}
                          className="h-[38px]"
                          style={{
                            background: activeChip ? rgba(meta.color, 0.15) : undefined,
                            borderColor: activeChip ? rgba(meta.color, 0.5) : undefined,
                            color: activeChip ? meta.color : undefined,
                          }}
                        >
                          <TypeGlyph type={tp} className="h-[15px] w-[15px]" />
                          {meta.label}
                        </OptionChip>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Identifier */}
              <AccountIdentifierField
                mode={idMode} onModeChange={setIdMode} allowsLast4={allowsLast4(type)}
                last4={last4} onLast4Change={setLast4} label={label} onLabelChange={setLabel}
              />

              {/* Currency */}
              <div>
                <div className={`mx-0.5 mb-2 ${microClassName}`}>
                  {t.paymentMethods.currency}
                </div>
                <CurrencyField value={curCode} onChange={(c) => setCurCode(c as unknown as Currency)} zIndexClassName={z.currency} className={ACCOUNT_CURRENCY_FIELD_CLASS} />
              </div>

              {/* Credit-card terms (debt fields) — only for the credit_card type */}
              {type === 'credit_card' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.paymentMethods.ccLimit}</span>
                    <AmountField value={ccLimit} onChange={setCcLimit} mode="decimal" currency={curCode} placeholder="30,000" />
                  </div>
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.moneyFlows.ccOpeningBalance}</span>
                    <AmountField value={ccOutstanding} onChange={setCcOutstanding} mode="decimal" currency={curCode} placeholder="8,420" />
                    <p className="mx-0.5 mt-1.5 text-[11.5px] text-[var(--color-brand-text-muted)]">{t.moneyFlows.ccOpeningHint}</p>
                  </div>
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.moneyFlows.ccDueDay}</span>
                    <AmountField value={ccStatementDay} onChange={(v) => setCcStatementDay(v.slice(0, 2))} mode="integer" placeholder="15" />
                    {dayInvalid ? <p role="alert" className="mx-0.5 mt-1.5 text-[12px] text-[var(--color-brand-red)]">{t.moneyFlows.dayRange}</p> : null}
                  </div>
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.paymentMethods.ccGraceDays}</span>
                    <AmountField value={ccGrace} onChange={(v) => setCcGrace(v.slice(0, 3))} mode="integer" placeholder="55" />
                  </div>
                </div>
              )}

              {/* Card colour */}
              <div>
                <div className={`mx-0.5 mb-2.5 ${microClassName}`}>
                  {t.paymentMethods.cardColour}
                </div>
                <ColorSwatchRow value={effectiveColor} onChange={setCardColor} />
              </div>

              {/* Set as default */}
              <Card variant="elevated" radius="sm" padding="none" className="flex items-center justify-between px-4 py-3.5">
                <span className="text-start">
                  <span className="block text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                    {t.paymentMethods.setDefault}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-[var(--color-brand-text-muted)]">
                    {t.paymentMethods.setDefaultSub}
                  </span>
                </span>
                <Switch
                  size="touch"
                  aria-label={t.paymentMethods.setDefault}
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </Card>
            </div>
          </div>

          <div className="sheet-cta flex shrink-0 items-center gap-3 border-t border-[var(--color-brand-border)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            {editing && onDelete ? (
              <Button variant="destructive" size="touch" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                {deleteLabel ?? t.common.delete}
              </Button>
            ) : null}
            <Button size="cta-block" onClick={handleSave} disabled={!canSave} className="flex-1 text-base font-semibold">
              {t.paymentMethods.saveMethod}
            </Button>
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
        issuesType={lockType}
      />

    </>
  )
}

// ── Floating card preview (pinned above the sheet, static/elevated) ───────────
function FloatingCardPreview({
  open, z = '', inline = false, hasProvider, color, type, name, typeLabel, tail, curCode,
}: {
  open: boolean
  z?: string
  /** md+ renders the card in the dialog's flow instead of pinned above it. */
  inline?: boolean
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

  const preview = (
    <>
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
    </>
  )

  if (inline) return <div className="relative mx-auto my-4 hidden h-[176px] w-[280px] shrink-0 md:block">{preview}</div>

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="pm-float-card"
          data-inert-exempt
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn('pointer-events-none fixed left-1/2 w-[280px] md:hidden', z)}
          // Centred in the space above the 58vh sheet; floor keeps it clear of the status bar.
          style={{ top: 'max(46px, calc(21dvh - 88px))', marginLeft: -140 }}
        >
          {preview}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
