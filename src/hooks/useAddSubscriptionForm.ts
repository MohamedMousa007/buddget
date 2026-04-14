'use client'

import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import {
  detectCatalogRegion,
  filterVisibleBrands,
  findBrandByKey,
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

/**
 * Add flow: catalog (always for new subs) → configure. Regional catalog prices apply when profile
 * maps to UAE/Egypt; otherwise the user enters amount manually. Edit opens configure directly.
 */
export function useAddSubscriptionForm(editing: Subscription | null, onClose: () => void) {
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

  const [step, setStep] = useState(() => (editing ? 2 : 1))
  const [search, setSearch] = useState('')
  const [pickedBrand, setPickedBrand] = useState<SubscriptionBrand | 'custom' | null>(() => {
    if (!editing) return null
    if (!editing.brandKey) return 'custom'
    return findBrandByKey(editing.brandKey) ?? 'custom'
  })
  const [customMode, setCustomMode] = useState(() => editing !== null && !editing.brandKey)

  const [name, setName] = useState(() => editing?.name ?? '')
  const [planName, setPlanName] = useState<string | null>(() => editing?.planName ?? null)
  const [amountStr, setAmountStr] = useState(() => (editing ? String(editing.amount) : ''))
  const [currency, setCurrency] = useState<Currency>(() => editing?.currency ?? settings.baseCurrency)
  const [billingCycle, setBillingCycle] = useState<SubscriptionBillingCycle>(
    () => editing?.billingCycle ?? 'monthly'
  )
  const [billingDay, setBillingDay] = useState(() => editing?.billingDay ?? new Date().getDate())
  const [startDate, setStartDate] = useState(() => editing?.startDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethodId, setPaymentMethodId] = useState(() =>
    editing?.paymentMethodId ?? defaultPmId(paymentMethods)
  )
  const [expenseCategory, setExpenseCategory] = useState(() => editing?.expenseCategory ?? 'Enjoyment')
  const [notes, setNotes] = useState(() => editing?.notes ?? '')
  const [planIndex, setPlanIndex] = useState(0)

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
      const plan = brand.plans[region][idx]
      if (!plan) return
      setPlanIndex(idx)
      setPlanName(plan.name)
      setBillingCycle(plan.cycle)
      const raw = plan.amount
      const catCur = REGION_CURRENCY[region] as Currency
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
      if (region && b.plans[region].length > 0) {
        const cur = clampFiatToAllowed(settings, REGION_CURRENCY[region] as Currency)
        setCurrency(cur)
        applyPlan(b, 0, cur)
      } else {
        setPlanName(null)
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
    const payload: Omit<Subscription, 'id' | 'createdAt' | 'cancelledAt' | 'linkedRecurringExpenseId'> = {
      name: name.trim(),
      brandKey,
      planName: planName?.trim() || null,
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
    currency,
    billingCycle,
    billingDay,
    startDate,
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
    pickedBrand && pickedBrand !== 'custom' && region && pickedBrand.plans[region].length > 0
      ? pickedBrand.plans[region]
      : []

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
    startDate,
    setStartDate,
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
    isEdit: !!editing,
  }
}

export type AddSubscriptionFormReturn = ReturnType<typeof useAddSubscriptionForm>
