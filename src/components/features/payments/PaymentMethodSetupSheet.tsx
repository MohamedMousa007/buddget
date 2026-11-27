'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Calendar, Lock, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { AccountAliasChips, InputRow, Last4Tiles } from '@/components/features/payments/accountFormParts'
import { accountTitle, cardKindLabel } from '@/components/features/accounts/accountDisplay'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { DayOfMonthSheet } from '@/components/ui/DayOfMonthSheet'
import { PickerRow } from '@/components/ui/PickerRow'
import { Pill } from '@/components/ui/PillButton'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
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
  allowsLast4, composePaymentMethodName, decomposePaymentMethodName,
  resolvePaymentBrandKey, prefillPaymentType, typesForBrand,
} from '@/lib/payment/paymentMethodDefaults'
import { cn } from '@/lib/utils'
import type { PmPrefill } from '@/lib/store/useSettingsStore'
import { mix, readable } from '@/lib/utils/color'
import type { Currency, PaymentMethod, PaymentMethodType } from '@/lib/store/types'
import { OptionChip } from '@/components/ui/OptionChip'
import { isSavableTail } from '@/lib/accounts/identity/accountRef'
import { useReattribute } from '@/lib/accounts/useReattribute'
import { linkableAccounts, linksToAccount, matchLinkedAccount, relinkNeedsConfirm, savedParentId } from '@/lib/accounts/cardLink'
import { canHoldParts, hasAccountHistory } from '@/lib/accounts/kinds'
import { AccountPicker } from '@/components/features/accounts/AccountPicker'
import { asksPaysFrom } from '@/lib/accounts/cardHold'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

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
  /** Render the form's body inside another sheet (a pushed step), with no ModalShell or floating preview of its own. Save then only calls `onSaved`. */
  embedded?: boolean
  /** Shown above the preview (a pushed step's "{account} added" summary). */
  summary?: ReactNode
  /** The header's back control; defaults to `onClose`. */
  onBack?: () => void
  /** Labelled card kinds offered beside the type chips: Virtual (a debit card labelled Virtual) or Store card (type other). */
  extraChoices?: CardChoice[]
  /** Types this entry never offers, in the type chips and the provider list (the card-only form hides wallets). */
  excludeTypes?: PaymentMethodType[]
}

export type CardChoice = 'virtual' | 'store'
const CHOICE_TYPE: Record<CardChoice, PaymentMethodType> = { virtual: 'debit_card', store: 'other' }

/**
 * Add / edit a payment method — floating live card preview (pinned above the
 * sheet) + provider field + colour slider + type/identifier/currency/default.
 * Reused by the wallet sheet and the payment-method picker (self-contained add).
 */
export function PaymentMethodSetupSheet({
  open, editing, prefill, baseCurrency, onClose, onSaved, nested = false, lockType, titleOverride, parentAccountId, onDelete, deleteLabel,
  embedded = false, summary, onBack, extraChoices, excludeTypes,
}: Props) {
  const t = useT()
  const addPaymentMethod = useFinanceStore((s) => s.addPaymentMethod)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const updateDebt = useFinanceStore((s) => s.updateDebt)
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const confirm = useConfirm()
  const linkable = useMemo(() => {
    const list = linkableAccounts(paymentMethods)
    // An edited card keeps showing its current account even if that one has since closed.
    const current = editing?.parentId && !list.some((a) => a.id === editing.parentId) ? paymentMethods.find((m) => m.id === editing.parentId) : undefined
    return current ? [...list, current] : list
  }, [paymentMethods, editing])

  const [brandId, setBrandId] = useState<string | null>(null)
  const [providerName, setProviderName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('debit_card')
  const [last4, setLast4] = useState('')
  const [label, setLabel] = useState('')
  const [aliases, setAliases] = useState<string[]>([])
  const [curCode, setCurCode] = useState<Currency>(baseCurrency)
  const [cardStyle, setCardStyle] = useState<CardStyle>('bank')
  const [cardTheme, setCardTheme] = useState<CardThemeKey | null>(null)
  const [themePicked, setThemePicked] = useState(false)
  const [isDefault, setIsDefault] = useState(false)
  const [providerSheetOpen, setProviderSheetOpen] = useState(false)
  const [linkedId, setLinkedId] = useState<string | undefined>(undefined)
  // A credit card that hangs under no account: the account that pays its bill (its hold-back lands there).
  const [paysFromId, setPaysFromId] = useState<string | undefined>(undefined)
  const [curTouched, setCurTouched] = useState(false)
  // Credit-card debt terms (only when type === 'credit_card').
  const [ccLimit, setCcLimit] = useState('')
  const [ccOutstanding, setCcOutstanding] = useState('')
  const [ccStatementDay, setCcStatementDay] = useState('')
  const [choice, setChoice] = useState<CardChoice | null>(null)
  const [curSheetOpen, setCurSheetOpen] = useState(false)
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const ltAll = useAccountsLtCopy()
  const lt = ltAll.addCard
  const ordinal = useLightTouchCopy().dayOfMonth.ordinal

  const prevOpen = useRef(false)
  useEscapeClose(open && !providerSheetOpen && !curSheetOpen && !daySheetOpen && !embedded, onClose)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initialise form when the sheet opens */
    if (open && !prevOpen.current) {
      setProviderSheetOpen(false); setCurSheetOpen(false); setDaySheetOpen(false); setThemePicked(false); setCurTouched(false); setChoice(null)
      if (editing) {
        const { provider, tag: decTag } = decomposePaymentMethodName(editing.name, editing.last4)
        // A label an older version folded into the name ("CIB · Salary") is shown as the label it always was.
        const savedLabel = editing.label ?? decTag
        setBrandId(null); setProviderName(provider); setType(editing.type)
        setLast4(editing.last4 ?? ''); setLabel(savedLabel); setAliases(editing.last4Aliases ?? [])
        setCurCode(editing.currency); setIsDefault(editing.isDefault); setLinkedId(editing.parentId); setPaysFromId(editing.paysFromPaymentMethodId)
        const look = cardLook(editing)
        setCardStyle(look.style); setCardTheme(look.theme)
        // Load the linked credit-card debt's terms so they're editable here.
        const linked = useFinanceStore.getState().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === editing.id)
        setCcLimit(linked?.creditLimit != null ? String(linked.creditLimit) : '')
        setCcOutstanding(linked?.startingBalance ? String(linked.startingBalance) : '')
        setCcStatementDay(linked?.paymentDueDay != null ? String(linked.paymentDueDay) : '')
      } else {
        setCcLimit(''); setCcOutstanding(''); setCcStatementDay(''); setPaysFromId(undefined)
        const parent = parentAccountId ? useFinanceStore.getState().paymentMethods.find((m) => m.id === parentAccountId) : undefined
        if (parent) {
          // A card added under an account starts as that account's debit card: same bank, currency and theme.
          const parentBrandId = resolvePaymentBrandKey(accountTitle(parent))
          setBrandId(parentBrandId); setProviderName(accountTitle(parent))
          setType('debit_card'); setLast4(''); setLabel('')
          setCurCode(parent.currency); setIsDefault(false); setLinkedId(parent.id)
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
          // A type that takes no last4 (wallet, bnpl) never starts with digits: the tiles are not offered for it.
          setLast4(prefill?.last4 && allowsLast4(pfType) ? prefill.last4 : ''); setLabel('')
          const suggestedParent = prefill?.parentId ? useFinanceStore.getState().paymentMethods.find((m) => m.id === prefill.parentId) : undefined
          setCurCode((prefill?.currency as Currency | undefined) ?? suggestedParent?.currency ?? baseCurrency); setCardStyle('bank'); setCardTheme(null); setIsDefault(false)
          setLinkedId(pfType === 'debit_card' ? suggestedParent?.id : undefined)
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
    setCardTheme(null); setProviderSheetOpen(false)
    relink(b.name, cur)
  }
  // A provider the user picks re-checks the link (never on open, so an SMS or account prefill stands). The card takes the account's currency until the user sets one.
  const relink = (provider: string, cur: Currency) => {
    const next = matchLinkedAccount(provider, String(cur), linkable)
    setLinkedId(next)
    const acc = next ? linkable.find((a) => a.id === next) : undefined
    setCurCode(!curTouched && acc ? acc.currency : cur)
  }
  const pickLinked = (id: string) => {
    const acc = linkable.find((a) => a.id === id)
    setLinkedId(acc?.id)
    if (acc && !curTouched) setCurCode(acc.currency)
  }
  // Types the chosen provider can plausibly issue (a bank offers account + cards,
  // Tabby only BNPL). Custom providers keep the full list. The current type is always
  // included so an existing method can never render with no matching chip.
  const offeredTypes = useMemo(() => {
    const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
    const allowed = typesForBrand(brand)
    return CARD_SETUP_TYPES.filter((t) => (allowed.includes(t) && !excludeTypes?.includes(t)) || t === type)
  }, [brandId, type, excludeTypes])

  const pickType = (v: PaymentMethodType) => {
    setType(v)
    setChoice(null)
  }
  const choiceLabel = (c: CardChoice) => (c === 'virtual' ? t.accountsPage.typeVirtual : t.accountsPage.typeStoreCard)
  // The kind is stored as the card's label, visible and editable in the Name row, so nothing hidden rides on it.
  const pickChoice = (c: CardChoice) => {
    setType(CHOICE_TYPE[c]); setChoice(c)
    setLabel((l) => (l.trim() ? l : choiceLabel(c)))
  }
  const setCustomProvider = (term: string) => {
    setBrandId('__custom'); setProviderName(term.trim()); setProviderSheetOpen(false)
    relink(term.trim(), curCode)
  }

  const brand = brandId && brandId !== '__custom' ? PAYMENT_BRANDS[brandId] : null
  // No theme picked yet: the one nearest the provider's brand colour (or the type's colour).
  const effectiveTheme: CardThemeKey = cardTheme ?? nearestCardTheme(brand ? brand.colors[0] : PAYMENT_TYPE_META[type].color)
  const reattribute = useReattribute()
  const hasProvider = providerName.trim().length > 0
  // The Debt tab locks the type; an existing bank account or wallet keeps its kind here (cards are the only thing this sheet can switch between).
  const typeLock: PaymentMethodType | undefined = lockType ?? (editing && !CARD_TYPES.includes(editing.type) ? editing.type : undefined)
  const dayInvalid = type === 'credit_card' && cardDayError(ccStatementDay)
  const canSave = hasProvider && !dayInvalid && (last4 === '' || isSavableTail(last4))

  const handleSave = async () => {
    if (!canSave) return
    const parentId = savedParentId(type, linkedId)
    const paysFromPaymentMethodId = type === 'credit_card' && !parentId ? paysFromId : undefined
    if (editing && relinkNeedsConfirm(editing, parentId, hasAccountHistory(useFinanceStore.getState(), editing.id))) {
      const target = parentId ?? editing.parentId
      const name = accountTitle(paymentMethods.find((m) => m.id === target) ?? editing)
      const body = (parentId ? t.paymentMethods.relinkBody : t.paymentMethods.unlinkBody).replace('{account}', name)
      if (!(await confirm({ title: t.paymentMethods.relinkTitle, body, confirmLabel: t.paymentMethods.relinkConfirm }))) return
    }
    const provider = providerName.trim()
    // Typed or stored digits are always kept, whatever the type or Name: SMS matching reads them.
    const use4 = last4.length > 0 && isSavableTail(last4)
    const words = label.trim()
    const name = composePaymentMethodName(provider, { last4: use4 ? last4 : undefined })
    // `color` stays a real hex (avatars and tints read it): the theme's first stop, or an edited method's own colour until a theme is picked.
    const color = editing?.color && !themePicked ? editing.color : CARD_THEMES[effectiveTheme].a
    const payload = { name, type, currency: curCode, color, cardStyle, cardTheme: effectiveTheme, isDefault, paysFromPaymentMethodId, ...(use4 ? { last4 } : {}), ...(words ? { label: words } : {}) }
    let pmId: string
    if (editing) {
      updatePaymentMethod(editing.id, { ...payload, last4: use4 ? last4 : undefined, last4Aliases: aliases.length > 0 ? aliases : undefined, label: words || undefined, ...(CARD_TYPES.includes(editing.type) ? { parentId } : {}) })
      pmId = editing.id
    } else {
      // A credit_card PM auto-creates its linked credit-card debt in the store.
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
    if (!embedded) onClose()
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

  const kindLabel = cardKindLabel(type, t.accountsPage)
  const previewProps = {
    theme: effectiveTheme, style: cardStyle,
    bank: hasProvider ? providerName : t.paymentMethods.addTitle,
    kind: kindLabel,
    last4: last4 || undefined,
    currency: curCode,
  }
  // Debit | Credit | Prepaid (+ Store card) as one segmented control; an entry offering more kinds (the generic add,
  // a custom provider) keeps the scrolling chip row so wallet, pay-later and other stay reachable.
  const segValues: string[] = [...offeredTypes, ...(extraChoices ?? [])]
  const segmented = segValues.length <= 4
  const segValue = choice ?? type
  const pickSeg = (v: string) => (v === 'store' || v === 'virtual' ? pickChoice(v) : pickType(v as PaymentMethodType))
  const linked = linkedId ? linkable.find((a) => a.id === linkedId) : undefined
  const showUses = linksToAccount(type) && type !== 'credit_card' && linkable.length > 0
  const payers = asksPaysFrom({ type, parentId: linkedId }) ? paymentMethods.filter((m) => canHoldParts(m)) : []
  // A card spending from an account takes that account's currency; one standing alone (or a credit card) picks its own.
  const showCurrency = !(showUses && linked)
  const defaultName = hasProvider ? `${providerName.trim()} ${kindLabel}${last4 ? ` \u2022\u2022${last4}` : ''}` : ''
  const sectionHead = 'px-1 pb-2 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]'
  const dueDay = parseCardDay(ccStatementDay)

  const body = (
        <div className="flex min-h-0 flex-1 flex-col outline-none">
          {/* Light touch: X and swipe close; a pushed step (onBack) keeps its Back. */}
          <V3SheetHeader
            onClose={onClose}
            leading={
              onBack && !lockType ? (
                <IconButton aria-label={t.common.back} onClick={onBack} variant="sheetAction">
                  <ArrowLeft className="rtl:rotate-180" />
                </IconButton>
              ) : undefined
            }
          >
            <V3SheetHeader.Title>{editing ? t.paymentMethods.editTitle : (titleOverride ?? (type === 'credit_card' ? lt.creditTitle : lt.title))}</V3SheetHeader.Title>
          </V3SheetHeader>

          <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col gap-3">
              {summary}
              <FloatingCardPreview open={open} inline={embedded ? 'always' : true} {...previewProps} />

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
              ) : !segmented ? (
                <div className="native-scroll -my-1 flex gap-1.5 overflow-x-auto py-1">
                  {offeredTypes.map((tp) => {
                    const meta = PAYMENT_TYPE_META[tp]
                    const activeChip = type === tp && choice === null
                    return (
                      <OptionChip key={tp} selected={activeChip} onClick={() => pickType(tp)} className="h-[38px]"
                        style={{
                          background: activeChip ? mix(meta.color, 15) : undefined,
                          borderColor: activeChip ? mix(meta.color, 50) : undefined,
                          color: activeChip ? readable(meta.color) : undefined,
                        }}>
                        <TypeGlyph type={tp} className="h-[15px] w-[15px]" />
                        {cardKindLabel(tp, t.accountsPage)}
                      </OptionChip>
                    )
                  })}
                  {extraChoices?.map((c) => (
                    <OptionChip key={c} selected={choice === c} onClick={() => pickChoice(c)} className="h-[38px]">
                      <TypeGlyph type={CHOICE_TYPE[c]} className="h-[15px] w-[15px]" />
                      {choiceLabel(c)}
                    </OptionChip>
                  ))}
                </div>
              ) : segValues.length > 1 ? (
                <SegmentedControl
                  ariaLabel={t.paymentMethods.type}
                  value={segValue}
                  onChange={pickSeg}
                  options={segValues.map((v) => ({ value: v, label: v === 'store' || v === 'virtual' ? choiceLabel(v) : cardKindLabel(v as PaymentMethodType, t.accountsPage) }))}
                />
              ) : null}

              <Card padding="none" divide className="overflow-hidden rounded-2xl">
                <PickerRow
                  label={lt.bankOrWallet}
                  onClick={() => setProviderSheetOpen(true)}
                  value={hasProvider ? (
                    <>
                      <BrandMark name={providerName} color={brand ? brand.colors[0] : PAYMENT_TYPE_META[type].color} size={24} logo={bankLogoForName(providerName)} />
                      <span dir="auto" className="truncate">{providerName}</span>
                    </>
                  ) : <span className="text-[var(--color-brand-text-muted)]">{ltAll.addAccount.choose}</span>}
                />
                {allowsLast4(type) || last4 ? <Last4Tiles value={last4} onChange={setLast4} optional /> : null}
                <InputRow label={t.accountsPage.cardName} value={label} onChange={setLabel} placeholder={defaultName || ltAll.addAccount.optional} />
                {showUses ? (
                  <AccountPicker
                    look="row"
                    accounts={linkable.map((m) => ({ method: m, cards: [], balance: null }))}
                    value={linkedId ?? ''} onChange={(id) => (id ? pickLinked(id) : setLinkedId(undefined))}
                    label={lt.uses} noneLabel={lt.usesNone} showBalance={false} zIndexClassName={z.provider}
                  />
                ) : null}
                {payers.length > 0 ? (
                  <AccountPicker
                    look="row"
                    accounts={payers.map((m) => ({ method: m, cards: [], balance: null }))}
                    value={paysFromId ?? ''} onChange={(id) => setPaysFromId(id || undefined)}
                    label={lt.paysFrom} noneLabel={lt.usesNone} showBalance={false} zIndexClassName={z.provider}
                  />
                ) : null}
                {showCurrency ? (
                  <PickerRow label={lt.currency} onClick={() => setCurSheetOpen(true)} value={<span dir="ltr" className="font-mono-numbers">{curCode}</span>} />
                ) : null}
              </Card>
              {editing ? <AccountAliasChips aliases={aliases} onRemove={(d) => setAliases((a) => a.filter((x) => x !== d))} /> : null}

              {type === 'credit_card' ? (
                <section>
                  <h3 className={sectionHead}>{lt.credit}</h3>
                  <Card padding="none" divide className="overflow-hidden rounded-2xl">
                    <InputRow label={lt.limit} value={ccLimit} onChange={setCcLimit} amountCurrency={curCode} placeholder="30,000" />
                    <InputRow label={lt.owedNow} value={ccOutstanding} onChange={setCcOutstanding} amountCurrency={curCode} placeholder="8,420" />
                    <PickerRow label={lt.dueDay} onClick={() => setDaySheetOpen(true)} chevron={false}
                      value={<Pill icon={<Calendar />}>{dueDay ? ordinal(dueDay) : ltAll.addAccount.choose}</Pill>} />
                  </Card>
                </section>
              ) : null}

              <section>
                <h3 className={sectionHead}>{lt.look}</h3>
                <Card padding="none" className="space-y-3 rounded-2xl p-3">
                  <SegmentedControl
                    ariaLabel={t.paymentMethods.cardStyle}
                    value={cardStyle}
                    onChange={setCardStyle}
                    options={[{ value: 'metal', label: lt.metal }, { value: 'bank', label: lt.classic }]}
                  />
                  <CardThemePicker value={effectiveTheme} onChange={(k) => { setCardTheme(k); setThemePicked(true) }} names={t.paymentMethods.themeNames} ariaLabel={t.paymentMethods.cardTheme} />
                </Card>
              </section>

              <Card padding="none" className="flex min-h-[52px] items-center gap-3 rounded-2xl px-4">
                <span className="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{t.accountsPage.defaultForNew}</span>
                <Switch size="touch" aria-label={t.accountsPage.defaultForNew} checked={isDefault} onCheckedChange={setIsDefault} />
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
              {editing ? lt.save : type === 'credit_card' ? lt.creditCta : lt.cta}
            </Button>
          </div>
          <CurrencySheet open={open && curSheetOpen} value={curCode} base={baseCurrency} zIndexClassName={z.currency}
            onSelect={(c) => { setCurCode(c as Currency); setCurTouched(true); setCurSheetOpen(false) }} onClose={() => setCurSheetOpen(false)} />
          <DayOfMonthSheet open={open && daySheetOpen} value={dueDay} title={lt.dueDay} zIndexClassName={z.currency}
            onChange={(d) => { setCcStatementDay(String(d)); setDaySheetOpen(false) }} onClose={() => setDaySheetOpen(false)} />
        </div>
  )

  const picker = (
      <ProviderPickerSheet
        open={open && providerSheetOpen}
        selectedId={brandId}
        popularIds={popularIds}
        zIndexClassName={z.provider}
        onPick={pickBrand}
        onCustom={setCustomProvider}
        onClose={() => setProviderSheetOpen(false)}
        issuesType={lockType}
        excludeTypes={excludeTypes}
        customLabel={ltAll.addAccount.notListed}
      />
  )

  if (embedded) return <>{body}{picker}</>
  return (
    <>
      <FloatingCardPreview open={open} z={z.card} {...previewProps} />
      <ModalShell open={open} onBackdropClick={onClose} scrollChild zIndexClassName={z.shell} panelClassName="h-[64dvh] md:h-[min(88dvh,760px)]">
        {body}
      </ModalShell>
      {picker}
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
  /** md+ renders the card in the dialog's flow instead of pinned above it; 'always' at every width (an embedded form). */
  inline?: boolean | 'always'
  theme: CardThemeKey
  style: CardStyle
  bank: string
  kind: string
  last4?: string
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

  if (inline) return <div className={cn('relative mx-auto my-4 h-[176px] w-[280px] shrink-0', inline === 'always' ? 'block' : 'hidden md:block')}>{preview}</div>

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
