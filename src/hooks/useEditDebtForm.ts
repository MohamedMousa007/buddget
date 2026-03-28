'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Debt, DebtCurrency, GoldKarat } from '@/lib/store/types'

export function useEditDebtForm(debt: Debt | undefined, isOpen: boolean) {
  const { updateDebt, deleteDebt, settings } = useFinanceStore()

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>('EGP')
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate form when editing debt opens */
    if (isOpen && debt) {
      setName(debt.name)
      setPerson(debt.person)
      setDescription(debt.description || '')
      setCurrency(debt.currency)
      setIsGold(debt.isGold)
      setGoldKarat(debt.goldKarat || 24)
      setNotes(debt.notes || '')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debt])

  const handleSave = useCallback(
    (onAfter: () => void) => {
      if (!debt || !name || !person) return

      updateDebt(debt.id, {
        name,
        person,
        description: description || undefined,
        currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
        isGold,
        goldKarat: isGold ? goldKarat : undefined,
        notes: notes || undefined,
      })

      onAfter()
    },
    [currency, debt, description, goldKarat, isGold, name, notes, person, settings, updateDebt]
  )

  const handleDelete = useCallback(
    (onAfter: () => void) => {
      if (!debt) return
      if (window.confirm(`Delete "${debt.name}" and all its payments? This cannot be undone.`)) {
        deleteDebt(debt.id)
        onAfter()
      }
    },
    [debt, deleteDebt]
  )

  return {
    name,
    setName,
    person,
    setPerson,
    description,
    setDescription,
    currency,
    setCurrency,
    isGold,
    setIsGold,
    goldKarat,
    setGoldKarat,
    notes,
    setNotes,
    handleSave,
    handleDelete,
  }
}
