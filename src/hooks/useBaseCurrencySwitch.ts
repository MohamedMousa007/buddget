'use client'

import { useCallback, useState } from 'react'
import { useActionToast } from '@/components/ui/ActionToast'
import { planBaseCurrencySwitch } from '@/lib/settings/baseCurrencySwitch'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'

/**
 * Changing the main currency is a two-step move: ask first, then apply with an undo.
 * `request` stages the target; the confirm sheet calls `confirm` or `cancel`.
 */
export function useBaseCurrencySwitch() {
  const copy = useSettingsHubCopy()
  const toast = useActionToast()
  const [pending, setPending] = useState<Currency | null>(null)
  const [noRate, setNoRate] = useState(false)

  const request = useCallback((next: Currency) => {
    if (next === useFinanceStore.getState().settings.baseCurrency) return
    setNoRate(false)
    setPending(next)
  }, [])

  const cancel = useCallback(() => {
    setPending(null)
    setNoRate(false)
  }, [])

  const confirm = useCallback(() => {
    if (!pending) return
    const before = useFinanceStore.getState()
    const result = planBaseCurrencySwitch(
      { settings: before.settings, profile: before.profile, budgetPlans: before.budgetPlans, exchangeRates: before.exchangeRates },
      pending,
    )
    if (!result.ok) {
      if (result.reason === 'noRate') setNoRate(true)
      else setPending(null)
      return
    }
    const snapshot = { settings: before.settings, profile: before.profile, budgetPlans: before.budgetPlans }
    useFinanceStore.setState(result.patch)
    toast(copy.currency.toast(pending), {
      undoLabel: copy.currency.undo,
      undo: () => useFinanceStore.setState(snapshot),
    })
    setPending(null)
  }, [pending, toast, copy])

  return { pending, noRate, request, cancel, confirm }
}
