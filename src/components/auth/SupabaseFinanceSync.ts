'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const DEBOUNCE_MS = 1600

function buildFinancePayload() {
  const state = useFinanceStore.getState()
  return {
    profile: state.profile,
    settings: state.settings,
    incomeSources: state.incomeSources,
    expenses: state.expenses,
    recurringExpenses: state.recurringExpenses,
    budgetCategories: state.budgetCategories,
    savingsHoldings: state.savingsHoldings,
    paymentMethods: state.paymentMethods,
    debts: state.debts,
    debtPayments: state.debtPayments,
  }
}

export function SupabaseFinanceSync({ userId }: { userId: string }) {
  const hydrated = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    hydrated.current = false
    const supabase = createClient()

    async function pull() {
      const { data, error } = await supabase
        .from('user_finance')
        .select('payload, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('[finance sync] load failed', error.message)
        hydrated.current = true
        return
      }

      if (data?.payload && typeof data.payload === 'object') {
        try {
          useFinanceStore.getState().importData(JSON.stringify(data.payload))
        } catch (e) {
          console.error('[finance sync] import failed', e)
        }
      }
      hydrated.current = true
    }

    void pull()

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  useEffect(() => {
    const supabase = createClient()

    const flush = () => {
      if (!hydrated.current) return
      timer.current = null
      const payload = buildFinancePayload()
      void supabase
        .from('user_finance')
        .upsert(
          {
            user_id: userId,
            payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('[finance sync] upsert failed', error.message)
        })
    }

    const unsub = useFinanceStore.subscribe(() => {
      if (!hydrated.current) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, DEBOUNCE_MS)
    })

    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [userId])

  return null
}
