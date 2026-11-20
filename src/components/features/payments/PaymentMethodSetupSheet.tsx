'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CreditCard, Lock, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { ACCOUNT_CURRENCY_FIELD_CLASS, AccountAliasChips, AccountIdentifierField, type Identifier } from '@/components/features/payments/accountFormParts'
import { accountTitle, cardKindLabel } from '@/components/features/accounts/accountDisplay'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/switch'
import { TypeGlyph } from '@/components/features/payments/PaymentCardCarousel'
import { CardFace, FACE_W } from '@/components/features/payments/CardFace'
import { CardThemePicker } from '@/components/features/payments/CardThemePicker'
import { CARD_THEMES, cardLook, nearestCardTheme, type CardStyle, type CardThemeKey } from '@/lib/payment/cardThemes'
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
import { mix, readable } from '@/lib/utils/color'
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
  const [aliases, setAliases] = useState<string[]>([])
  const [curCode, setCurCode] = useState<Currency>(baseCurrency)
  const [cardStyle, setCardStyle] = useState<CardStyle>('bank')
  const [cardTheme, setCardTheme] = useState<CardThemeKey | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [providerSheetOpen, setProviderSheetOpen] = useState(false)
  // Credit-card debt terms (only when type === 'credit_card').
  const [ccLimit, setCcLimit] = useState('')
  const [ccOutstanding, setCcOutstanding] = useState('')
  const [ccStatementDay, setCcStatementDay] = useState('')

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
        setLast4(editing.last4 ?? ''); setLabel(savedLabel); setAliases(editing.last4Aliases ?? [])
        setIdMode(savedLabel ? 'label' : editing.last4 ? 'last4' : 'none')
        setCurCode(editing.currency); setIsDefault(editing.isDefault)
        const look = cardLook(editing)
        setCardStyle(look.style); setCardTheme(look.theme)
        // Load the linked credit-card debt's terms so they're editable here.
        const linked = useFinanceStore.getState().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === editing.id)
        setCcLimit(linked?.creditLimit != null ? String(linked.creditLimit) : '')
        setCcOutstanding(linked?.startingBalance ? String(linked.startingBalance) : '')
        setCcStatementDay(linked?.paymentDueDay != null ? String(linked.paymentDueDay) : '')
      } else {
        setCcLimit(''); setCcOutstanding(''); setCcStatementDay('')
        const parent = parentAccountId ? useFinanceStore.getState().paymentMethods.find((m) => m.id === parentAccountId) : undefined
        if (parent) {
          // A card added under an account starts as that account's debit card: same bank, currency and theme.
          const parentBrandId = resolvePaymentBrandKey(accountTitle(parent))
          setBrandId(parentBrandId); setProviderName(accountTitle(parent))
          setType('debit_card'); setLast4(''); setLabel(''); setIdMode('none')
          setCurCode(parent.currency); setIsDefault(false)
          const look = cardLook(parent)
          setCardStyle(look.style); setCardTheme(look.theme)
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
          setCurCode((prefill?.currency as Currency | undefined) ?? suggestedParent?.currency ?? baseCurrency); setCardStyle('bank'); setCardTheme(null); setIsDefault(false)
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
    setCardTheme(null); setCurCode(cur); setProviderSheetOpen(false)
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
  // No theme picked yet: the one nearest the provider's brand colour (or the type's colour).
  const effectiveTheme: CardThemeKey = cardTheme ?? nearestCardTheme(brand ? brand.colors[0] : PAYMENT_TYPE_META[type].color)
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
    // `color` stays a real hex (avatars and tints read it): the theme's first stop.
    const payload = { name, type, currency: curCode, color: CARD_THEMES[effectiveTheme].a, cardStyle, cardTheme: effectiveTheme, isDefault, ...(use4 ? { last4 } : {}), ...(words ? { label: words } : {}) }
    let pmId: string
    if (editing) {
      updatePaymentMethod(editing.id, { ...payload, last4: use4 ? last4 : undefined, last4Aliases: aliases.length > 0 ? aliases : undefined, label: words || undefined })
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
  const fieldChipColor = brand ? brand.colors[0] : 'var(--color-brand-text-muted)'
  const fieldInitials = brand ? brand.short : providerInitials(providerName)

  const previewProps = {
    theme: effectiveTheme, style: cardStyle,
    bank: hasProvider ? providerName : t.paymentMethods.addTitle,
    kind: cardKindLabel(type, t.accountsPage),
    last4: idMode !== 'none' && last4 ? last4 : undefined,
    holder: idMode === 'label' ? label.trim() : undefined,
    currency: curCode,
  }

  return (
    <>
      <FloatingCardPreview open={open} z={z.card} {...previewProps} />

      <ModalShell open={open} onBackdropClick={onClose} scrollChild zIndexClassName={z.shell} panelClassName="h-[64dvh]">
        <div className="flex min-h-0 flex-1 flex-col outline-none">
          {/* Debt context (lockType) follows the debt-sheet rule: X + swipe only, no Back. */}
          <V3SheetHeader
            onClose={onClose}
            leading={
              !lockType ? (
                <IconButton aria-label={t.common.back} onClick={onClose} variant="tinted" size="sm" shape="round">
                  <ArrowLeft className="rtl:rotate-180" />
                </IconButton>
              ) : undefined
            }
          >
            <V3SheetHeader.Title>{editing ? t.paymentMethods.editTitle : (titleOverride ?? t.paymentMethods.addTitle)}</V3SheetHeader.Title>
          </V3SheetHeader>

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
                  valueClassName="text-[0.90625rem] font-semibold"
                  value={hasProvider ? providerName : undefined}
                  placeholder={t.paymentMethods.providerPlaceholder}
                  icon={
                    <span
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[0.6875rem] font-extrabold"
                      style={hasProvider
                        ? { background: mix(fieldChipColor, 16), color: fieldChipColor }
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
                    className="flex h-[38px] w-fit items-center gap-[7px] rounded-full px-3.5 text-[0.8125rem] font-semibold"
                    style={{
                      background: mix(PAYMENT_TYPE_META[typeLock].color, 15),
                      border: `1px solid ${mix(PAYMENT_TYPE_META[typeLock].color, 50)}`,
                      color: readable(PAYMENT_TYPE_META[typeLock].color),
                    }}
                  >
                    <TypeGlyph type={typeLock} className="h-[15px] w-[15px]" />
                    {PAYMENT_TYPE_META[typeLock].label}
                    <Lock className="h-3.5 w-3.5 opacity-70" />
                  </div>
                ) : (
                  <div className="native-scroll -my-1 flex gap-1.5 overflow-x-auto py-1">
                    {offeredTypes.map((tp) => {
                      const meta = PAYMENT_TYPE_META[tp]
                      const activeChip = type === tp
                      return (
                        <OptionChip
                          key={tp} selected={activeChip} onClick={() => pickType(tp)}
                          className="h-[38px]"
                          style={{
                            background: activeChip ? mix(meta.color, 15) : undefined,
                            borderColor: activeChip ? mix(meta.color, 50) : undefined,
                            color: activeChip ? readable(meta.color) : undefined,
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
              {editing ? <AccountAliasChips aliases={aliases} onRemove={(d) => setAliases((a) => a.filter((x) => x !== d))} /> : null}

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
                    <AmountField value={ccLimit} onChange={setCcLimit} mode="decimal" currency={curCode} aria-label={t.paymentMethods.ccLimit} placeholder="30,000" />
                  </div>
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.moneyFlows.ccOpeningBalance}</span>
                    <AmountField value={ccOutstanding} onChange={setCcOutstanding} mode="decimal" currency={curCode} aria-label={t.moneyFlows.ccOpeningBalance} placeholder="8,420" />
                    <p className="mx-0.5 mt-1.5 text-[0.71875rem] text-[var(--color-brand-text-muted)]">{t.moneyFlows.ccOpeningHint}</p>
                  </div>
                  <div>
                    <span className={`mx-0.5 mb-2 block ${microClassName}`}>{t.moneyFlows.ccDueDay}</span>
                    <AmountField value={ccStatementDay} onChange={(v) => setCcStatementDay(v.slice(0, 2))} mode="integer" aria-label={t.moneyFlows.ccDueDay} placeholder="15" />
                    {dayInvalid ? <p role="alert" className="mx-0.5 mt-1.5 text-[0.75rem] text-[var(--color-brand-red)]">{t.moneyFlows.dayRange}</p> : null}
                  </div>
                </div>
              )}

              {/* Card style + theme */}
              <div>
                <div className={`mx-0.5 mb-2 ${microClassName}`}>
                  {t.paymentMethods.cardStyle}
                </div>
                <SegmentedControl
                  ariaLabel={t.paymentMethods.cardStyle}
                  value={cardStyle}
                  onChange={setCardStyle}
                  options={[{ value: 'metal', label: t.paymentMethods.styleMetal }, { value: 'bank', label: t.paymentMethods.styleBank }]}
                />
              </div>
              <div>
                <div className="mx-0.5 mb-2.5 flex items-baseline justify-between">
                  <span className={microClassName}>{t.paymentMethods.cardTheme}</span>
                  <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.paymentMethods.themeNames[effectiveTheme]}</span>
                </div>
                <CardThemePicker value={effectiveTheme} onChange={setCardTheme} names={t.paymentMethods.themeNames} ariaLabel={t.paymentMethods.cardTheme} />
              </div>

              {/* Set as default */}
              <Card variant="elevated" radius="sm" padding="none" className="flex items-center justify-between px-4 py-3.5">
                <span className="text-start">
                  <span className="block text-sm font-semibold text-[var(--color-brand-text-secondary)]">
                    {t.paymentMethods.setDefault}
                  </span>
                  <span className="mt-0.5 block text-[0.71875rem] text-[var(--color-brand-text-muted)]">
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
const PREVIEW_W = 280

function FloatingCardPreview({
  open, z = '', inline = false, ...face
}: {
  open: boolean
  z?: string
  /** md+ renders the card in the dialog's flow instead of pinned above it. */
  inline?: boolean
  theme: CardThemeKey
  style: CardStyle
  bank: string
  kind: string
  last4?: string
  holder?: string
  currency: string
}) {
  if (typeof document === 'undefined') return null

  // Always a live card (reflects style/theme/type/digits/currency immediately), with the theme's soft halo behind it.
  const preview = (
    <>
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        inset: -34, borderRadius: 46,
        background: `radial-gradient(circle, ${mix(CARD_THEMES[face.theme].a, 70)}, transparent 68%)`,
        filter: 'blur(36px)', zIndex: 0,
      }}
    />
    <CardFace {...face} scale={PREVIEW_W / FACE_W} />
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
