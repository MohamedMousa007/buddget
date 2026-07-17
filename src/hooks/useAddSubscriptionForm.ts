'use client'

import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import type { SubscriptionPrefill } from '@/lib/store/useSettingsStore'
import {
  detectCatalogRegion,
  filterVisibleBrands,
  findBrandByKey,
  plansForRegion,
  REGION_CURRENCY,
  SUBSCRIPTION_CATALOG,
  type SubscriptionBrand,
} from '@/lib/constants/subscriptionCatalog'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, Subscription, SubscriptionBillingCycle } from '@/lib/store/types'

function defaultPmId(pms: { id: string; isDefault: boolean }[]): string {
  return pms.find((m) => m.isDefault)?.id || pms[0]?.id || ''
}

/** Picks a calendar date on `billingDay` in the current or previous month (when that day has not occurred yet this month). */
function computeStartDateFromBillingDay(billingDay: number): string {
  const today = new Date()
  const day = Math.min(31, Math.max(1, billingDay))
  const domToday = today.getDate()
  let y = today.getFullYear()
  let m = today.getMonth()
  if (domToday < day) {
    m -= 1
    if (m < 0) {
      m = 11
      y -= 1
    }
  }
  const lastDayOfMonth = new Date(y, m + 1, 0).getDate()
  const dom = Math.min(day, lastDayOfMonth)
  return format(new Date(y, m, dom), 'yyyy-MM-dd')
}

/**
 * Add flow: catalog (always for new subs) → configure. Regional catalog prices apply when profile
 * maps to UAE/Egypt; otherwise the user enters amount manually. Edit opens configure directly.
 * `startDate` on save is derived from `billingDay` (see `computeStartDateFromBillingDay`).
 */
export function useAddSubscriptionForm(
  editing: Subscription | null,
  onClose: () => void,
  /** Seed from a detected charge. The amount is what was ACTUALLY billed, so it beats
   *  the catalog price — never overwrite it with a plan default. */
  prefill?: SubscriptionPrefill | null,
) {
  const seedBrand = prefill?.brandKey ? findBrandByKey(prefill.brandKey) : undefined
  const { profile, settings, exchangeRates, paymentMethods, addSubscription, updateSubscription } =
    useFinanceStore(
      useShallow((s) => ({
        profile: s.profile,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        paymentMethods: s.paymentMethods,
        addSubscription: s.addSubscription,
        updateSubscription: s.updateSubscription,
      }))
    )

  const region = useMemo(() => detectCatalogRegion(profile), [profile])
  const showCatalog = !editing

  const [step, setStep] = useState(() => (editing || seedBrand ? 2 : 1))
  const [search, setSearch] = useState('')
  const [pickedBrand, setPickedBrand] = useState<SubscriptionBrand | 'custom' | null>(() => {
    if (!editing) return seedBrand ?? null
    if (!editing.brandKey) return 'custom'
    return findBrandByKey(editing.brandKey) ?? 'custom'
  })
  const [customMode, setCustomMode] = useState(() => editing !== null && !editing.brandKey)

  const [name, setName] = useState(() => editing?.name ?? seedBrand?.name ?? '')
  const [planName, setPlanName] = useState<string | null>(() => editing?.planName ?? null)
  // The label is what we SHOW; the id is what we STORE. A label can be edited in the
  // catalog, so it cannot identify the plan later.
  const [planId, setPlanId] = useState<string | null>(() => editing?.planId ?? null)
  const [amountStr, setAmountStr] = useState(() =>
    editing ? String(editing.amount) : prefill?.amount ? String(prefill.amount) : ''
  )
  const [currency, setCurrency] = useState<Currency>(
    () => editing?.currency ?? (prefill?.currency as Currency | undefined) ?? settings.baseCurrency
  )
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    () => editing?.billingCycle ?? 'monthly'
  )
  const [billingDay, setBillingDay] = useState(() => {
    const d = editing?.billingDay ?? prefill?.billingDay ?? new Date().getDate()
    return Math.min(31, Math.max(1, d))
  })
  const [paymentMethodId, setPaymentMethodId] = useState(() =>
    editing?.paymentMethodId ?? defaultPmId(paymentMethods)
  )
  const [expenseCategory, setExpenseCategory] = useState(
    () => editing?.expenseCategory ?? seedBrand?.defaultCategory ?? 'Enjoyment'
  )
  const [notes, setNotes] = useState(() => editing?.notes ?? '')
  const [planIndex, setPlanIndex] = useState(0)

  const canSubmit = useMemo(() => {
    const amount = Number.parseFloat(amountStr.replace(',', '.'))
    return name.trim().length > 0 && !Number.isNaN(amount) && amount > 0
  }, [name, amountStr])

  const availableBrands = useMemo(() => {
    const visible = filterVisibleBrands(SUBSCRIPTION_CATALOG, region)
    const q = search.trim().toLowerCase()
    return visible.filter(
      (b) => q === '' || b.name.toLowerCase().includes(q) || b.key.toLowerCase().includes(q)
    )
  }, [region, search])

  const applyPlan = useCallback(
    (brand: SubscriptionBrand, idx: number, targetCur: Currency) => {
      if (!region) return
      const plan = plansForRegion(brand, region)[idx]
      if (!plan) return
      setPlanIndex(idx)
      setPlanName(plan.name)
      setPlanId(plan.id)
      setBillingCycle(plan.cycle)
      const raw = plan.amount
      // A plan may be billed in a fixed currency worldwide (USD for most global
      // software); otherwise it is quoted in the region's own currency.
      const catCur = plan.currency ?? (REGION_CURRENCY[region] as Currency)
      const converted =
        catCur === targetCur ? raw : convertCurrency(raw, catCur, targetCur, exchangeRates)
      setAmountStr(String(Math.round(converted * 100) / 100))
    },
    [region, exchangeRates]
  )

  const pickBrand = useCallback(
    (b: SubscriptionBrand | 'custom') => {
      if (b === 'custom') {
        setPickedBrand('custom')
        setCustomMode(true)
        setName('')
        setPlanName(null)
        setPlanId(null)
        setPlanIndex(0)
        setAmountStr('')
        setBillingCycle('monthly')
        setExpenseCategory('Enjoyment')
        setCurrency(clampFiatToAllowed(settings, settings.baseCurrency))
        setStep(2)
        return
      }
      setPickedBrand(b)
      setCustomMode(false)
      setName(b.name)
      setExpenseCategory(b.defaultCategory)
      setPlanIndex(0)
      if (region && plansForRegion(b, region).length > 0) {
        const cur = clampFiatToAllowed(settings, REGION_CURRENCY[region] as Currency)
        setCurrency(cur)
        applyPlan(b, 0, cur)
      } else {
        // Brand has no catalog plans in this region — clear any plan carried over from a
        // previously-picked brand, or submit persists a foreign planId (e.g. Watch iT with
        // netflix_standard).
        setPlanName(null)
        setPlanId(null)
        setAmountStr('')
        setBillingCycle('monthly')
        setCurrency(clampFiatToAllowed(settings, settings.baseCurrency))
      }
      setStep(2)
    },
    [applyPlan, region, settings]
  )

  const onPlanIndexChange = useCallback(
    (idx: number) => {
      if (pickedBrand && pickedBrand !== 'custom' && region) {
        applyPlan(pickedBrand, idx, currency)
      }
    },
    [applyPlan, pickedBrand, region, currency]
  )

  const submit = useCallback(() => {
    const amount = Number.parseFloat(amountStr.replace(',', '.'))
    if (!name.trim() || Number.isNaN(amount) || amount <= 0) return
    const cur = clampFiatToAllowed(settings, currency)
    const brandKey = customMode || pickedBrand === 'custom' || !pickedBrand ? null : pickedBrand.key
    const startDate = computeStartDateFromBillingDay(billingDay)
    const payload: Omit<Subscription, 'id' | 'createdAt' | 'cancelledAt' | 'linkedRecurringExpenseId'> = {
      name: name.trim(),
      brandKey,
      planName: planName?.trim() || null,
      planId: brandKey ? planId : null,
      catalogRegion: brandKey ? region : null,
      pendingPlanId: null,
      pendingAmount: null,
      amount,
      currency: cur,
      billingCycle,
      billingDay: Math.min(31, Math.max(1, billingDay)),
      startDate,
      nextBillingDate: null,
      paymentMethodId: paymentMethodId || null,
      expenseCategory: expenseCategory || 'Enjoyment',
      status: editing ? editing.status : 'active',
      notes: notes.trim() || null,
    }
    if (editing) {
      updateSubscription(editing.id, payload)
    } else {
      addSubscription(payload)
    }
    onClose()
  }, [
    amountStr,
    name,
    planName,
    planId,
    region,
    currency,
    billingCycle,
    billingDay,
    paymentMethodId,
    expenseCategory,
    notes,
    customMode,
    pickedBrand,
    addSubscription,
    updateSubscription,
    editing,
    onClose,
    settings,
  ])

  const plansForPicker =
    pickedBrand && pickedBrand !== 'custom' ? plansForRegion(pickedBrand, region) : []

  return {
    region,
    showCatalog,
    step,
    setStep,
    search,
    setSearch,
    availableBrands,
    pickedBrand,
    pickBrand,
    customMode,
    name,
    setName,
    planName,
    setPlanName,
    amountStr,
    setAmountStr,
    currency,
    setCurrency,
    billingCycle,
    setBillingCycle,
    billingDay,
    setBillingDay,
    paymentMethodId,
    setPaymentMethodId,
    expenseCategory,
    setExpenseCategory,
    notes,
    setNotes,
    planIndex,
    onPlanIndexChange,
    plansForPicker,
    paymentMethods,
    submit,
    canSubmit,
    isEdit: !!editing,
  }
}

export type AddSubscriptionFormReturn = ReturnType<typeof useAddSubscriptionForm>
