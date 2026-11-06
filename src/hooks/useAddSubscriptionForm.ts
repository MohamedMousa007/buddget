'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  findBrandByKey,
  plansForRegion,
  REGION_CURRENCY,
  type CatalogRegion,
  type SubscriptionBrand,
  type SubscriptionPlan,
} from '@/lib/constants/subscriptionCatalog'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, Subscription } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { catalogGrid, catalogRegionOf, defaultPlan, type AddCategory } from '@/lib/subscriptions/catalogDisplay'
import {
  committedImpact,
  draftToSubscription,
  type SubscriptionDraft,
} from '@/lib/subscriptions/subscriptionDraft'

function defaultPmId(pms: { id: string; isDefault: boolean }[]): string {
  return pms.find((m) => m.isDefault)?.id || pms[0]?.id || ''
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The add / edit flow. New subscriptions start at the catalog (step 1) unless a brand is
 * already chosen; editing opens the configure step prefilled. Amounts stay in the plan's own
 * currency: a USD plan is $20 with an ≈ EGP estimate, never silently converted.
 */
export function useAddSubscriptionForm(editing: Subscription | null, onClose: () => void, seedBrandKey: string | null) {
  const { profile, settings, exchangeRates, paymentMethods, subscriptions, addSubscription, updateSubscription } =
    useFinanceStore(
      useShallow((s) => ({
        profile: s.profile,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        paymentMethods: s.paymentMethods,
        subscriptions: s.subscriptions,
        addSubscription: s.addSubscription,
        updateSubscription: s.updateSubscription,
      })),
    )
  const base = settings.baseCurrency
  const region = useMemo(() => catalogRegionOf(profile), [profile])
  const regionCurrency = (region ? REGION_CURRENCY[region] : base) as Currency
  const today = localTodayISO()
  const submitOnce = useSubmitOnce()

  const [step, setStep] = useState<1 | 2>(() => (editing || seedBrandKey ? 2 : 1))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<AddCategory | null>(null)
  const [draft, setDraft] = useState<SubscriptionDraft>(() => {
    if (editing) {
      return {
        name: editing.name,
        brandKey: editing.brandKey,
        planId: editing.planId,
        planName: editing.planName,
        planRegion: editing.catalogRegion,
        amount: editing.amount,
        currency: editing.currency,
        cycle: editing.billingCycle,
        firstCharge: editing.status === 'trial' && editing.trialEnd ? editing.trialEnd.slice(0, 10) : editing.startDate.slice(0, 10),
        paymentMethodId: editing.paymentMethodId,
        tracking: editing.tracking ?? 'sms',
        reminder: editing.reminder ?? true,
        trial: editing.status === 'trial',
        sharedWith: editing.sharedWith ?? [],
        myShare: editing.myShare ?? null,
        category: editing.expenseCategory,
        notes: editing.notes ?? '',
      }
    }
    const blank = blankDraft(base, defaultPmId(paymentMethods), today)
    const seed = findBrandByKey(seedBrandKey)
    const plan = seed && defaultPlan(seed, region)
    if (!seed) return blank
    if (!plan) return { ...blank, brandKey: seed.key, name: seed.name, category: seed.defaultCategory }
    return {
      ...blank,
      brandKey: seed.key,
      name: seed.name,
      category: seed.defaultCategory,
      planId: plan.id,
      planName: plan.name,
      planRegion: region,
      cycle: plan.cycle,
      amount: plan.amount,
      currency: clampFiatToAllowed(settings, (plan.currency ?? regionCurrency) as Currency),
    }
  })

  const patch = useCallback((p: Partial<SubscriptionDraft>) => setDraft((d) => ({ ...d, ...p })), [])

  const brand: SubscriptionBrand | null = useMemo(() => findBrandByKey(draft.brandKey) ?? null, [draft.brandKey])
  const plans: SubscriptionPlan[] = useMemo(
    () => (brand ? plansForRegion(brand, (draft.planRegion as CatalogRegion | null) ?? region) : []),
    [brand, draft.planRegion, region],
  )
  const planIndex = Math.max(0, plans.findIndex((p) => p.id === draft.planId))

  const pickPlan = useCallback(
    (plan: SubscriptionPlan, forBrand: SubscriptionBrand) => {
      patch({
        brandKey: forBrand.key,
        name: forBrand.name,
        category: forBrand.defaultCategory,
        planId: plan.id,
        planName: plan.name,
        planRegion: region,
        cycle: plan.cycle,
        amount: plan.amount,
        currency: clampFiatToAllowed(settings, (plan.currency ?? regionCurrency) as Currency),
      })
    },
    [patch, region, regionCurrency, settings],
  )

  const pickBrand = useCallback(
    (key: string | 'custom') => {
      if (key === 'custom') {
        patch({
          brandKey: null,
          name: '',
          planId: null,
          planName: null,
          planRegion: null,
          amount: 0,
          cycle: 'monthly',
          currency: clampFiatToAllowed(settings, base),
          category: 'Enjoyment',
        })
        setStep(2)
        return
      }
      const b = findBrandByKey(key)
      if (!b) return
      const plan = defaultPlan(b, region)
      if (plan) pickPlan(plan, b)
      else
        patch({
          brandKey: b.key,
          name: b.name,
          planId: null,
          planName: null,
          planRegion: null,
          amount: 0,
          cycle: 'monthly',
          currency: clampFiatToAllowed(settings, base),
          category: b.defaultCategory,
        })
      setStep(2)
    },
    [base, patch, pickPlan, region, settings],
  )

  /** Switching the unit re-expresses the entered amount at the quoted rate. */
  const setCurrency = useCallback(
    (next: Currency) => {
      setDraft((d) => {
        if (next === d.currency) return d
        const converted = tryConvertCurrency(d.amount, d.currency, next, exchangeRates)
        const share = d.myShare == null ? null : tryConvertCurrency(d.myShare, d.currency, next, exchangeRates)
        return {
          ...d,
          currency: next,
          amount: converted == null ? d.amount : round2(converted),
          myShare: share == null ? d.myShare : round2(share),
        }
      })
    },
    [exchangeRates],
  )

  const brands = useMemo(() => catalogGrid(region, category, search), [region, category, search])

  const planCurrency = (plans[planIndex]?.currency ?? regionCurrency) as Currency
  /** Units offered for a catalog service: the base currency, the plan's own, and USD (most global billing). */
  const currencyChoices: Currency[] = useMemo(() => {
    if (!brand) return []
    const all = [base, planCurrency, 'USD' as Currency, draft.currency]
    return all.filter((c, i) => all.indexOf(c) === i).slice(0, 3)
  }, [brand, base, planCurrency, draft.currency])

  const fx = useMemo(() => {
    if (draft.currency === base) return null
    const rate = tryConvertCurrency(1, draft.currency, base, exchangeRates)
    return rate == null ? null : { estimate: convertCurrency(draft.amount, draft.currency, base, exchangeRates), rate }
  }, [draft.amount, draft.currency, base, exchangeRates])

  const impact = useMemo(
    () => committedImpact(draft, subscriptions, editing?.id ?? null, base, exchangeRates),
    [draft, subscriptions, editing, base, exchangeRates],
  )

  const canSubmit =
    draft.name.trim().length > 0 &&
    draft.amount > 0 &&
    (draft.sharedWith.length === 0 || (draft.myShare != null && draft.myShare > 0 && draft.myShare <= draft.amount))

  const submit = useCallback(() => {
    if (!canSubmit || !submitOnce.claim()) return
    const payload = draftToSubscription({ ...draft, currency: editing && draft.currency === editing.currency ? draft.currency : clampFiatToAllowed(settings, draft.currency) }, editing, today)
    if (editing) updateSubscription(editing.id, payload)
    else addSubscription(payload)
    onClose()
  }, [addSubscription, canSubmit, draft, editing, onClose, settings, submitOnce, today, updateSubscription])

  return {
    base,
    region,
    isEdit: editing !== null,
    step,
    setStep,
    search,
    setSearch,
    category,
    setCategory,
    brands,
    brand,
    draft,
    patch,
    plans,
    planIndex,
    pickPlan: (plan: SubscriptionPlan) => brand && pickPlan(plan, brand),
    pickBrand,
    setCurrency,
    currencyChoices,
    fx,
    impact,
    paymentMethods,
    canSubmit,
    submit,
  }
}

function blankDraft(base: Currency, paymentMethodId: string, today: string): SubscriptionDraft {
  return {
    name: '',
    brandKey: null,
    planId: null,
    planName: null,
    planRegion: null,
    amount: 0,
    currency: base,
    cycle: 'monthly',
    firstCharge: today,
    paymentMethodId: paymentMethodId || null,
    tracking: 'sms',
    reminder: true,
    trial: false,
    sharedWith: [],
    myShare: null,
    category: 'Enjoyment',
    notes: '',
  }
}

export type AddSubscriptionFormReturn = ReturnType<typeof useAddSubscriptionForm>
