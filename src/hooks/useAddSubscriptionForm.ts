'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { SubscriptionPrefill } from '@/lib/store/useSettingsStore'
import {
  detectCatalogRegion,
  filterVisibleBrands,
  findBrandByKey,
  plansForRegion,
  REGION_CURRENCY,
  SUBSCRIPTION_CATALOG,
  type CatalogRegion,
  type SubscriptionBrand,
} from '@/lib/constants/subscriptionCatalog'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { convertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { startDateForSave } from '@/lib/subscriptions/subscriptionStartDate'
import type { Currency, Subscription, SubscriptionBillingCycle } from '@/lib/store/types'

function defaultPmId(pms: { id: string; isDefault: boolean }[]): string {
  return pms.find((m) => m.isDefault)?.id || pms[0]?.id || ''
}

/**
 * Add flow: catalog (always for new subs) → configure. Regional catalog prices apply when profile
 * maps to UAE/Egypt; otherwise the user enters amount manually. Edit opens configure directly.
 * `startDate` on save is derived from `billingDay` (see `startDateForSave`).
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
  const [planIndex, setPlanIndex] = useState(() => {
    if (!editing?.planId || !editing.brandKey) return 0
    const brand = findBrandByKey(editing.brandKey)
    const plans = brand ? plansForRegion(brand, (editing.catalogRegion as CatalogRegion | null) ?? region) : []
    return Math.max(0, plans.findIndex((p) => p.id === editing.planId))
  })
  // The region whose pricing the chosen plan came from. Editing must not re-stamp it with
  // wherever the user is now: planChange compares against THIS column.
  const [planRegion, setPlanRegion] = useState<CatalogRegion | null>(
    () => (editing?.catalogRegion as CatalogRegion | null | undefined) ?? null
  )

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
      setPlanRegion(region)
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
    const startDate = startDateForSave(editing, billingDay)
    const resolvedPlanId = brandKey ? planId : null
    // An edit that leaves the plan and price alone must not silently drop a pending
    // "you moved to Premium" prompt; one that changes either has answered it.
    const resolvesPending =
      !editing || editing.planId !== resolvedPlanId || editing.amount !== amount
    const payload: Omit<Subscription, 'id' | 'createdAt' | 'cancelledAt' | 'linkedRecurringExpenseId'> = {
      name: name.trim(),
      brandKey,
      planName: planName?.trim() || null,
      planId: resolvedPlanId,
      catalogRegion: brandKey ? (planRegion ?? region) : null,
      pendingPlanId: resolvesPending ? null : editing.pendingPlanId,
      pendingAmount: resolvesPending ? null : editing.pendingAmount,
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
    planRegion,
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
