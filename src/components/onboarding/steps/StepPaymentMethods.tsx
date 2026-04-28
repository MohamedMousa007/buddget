'use client'

import { useState } from 'react'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import type { PaymentMethodType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const OPTIONS: { type: PaymentMethodType; label: string; icon: string }[] = [
  { type: 'cash', label: 'Cash', icon: '💵' },
  { type: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { type: 'nol', label: 'Silver Nol', icon: '🚇' },
  { type: 'nol', label: 'Gold Nol', icon: '🥇' },
  { type: 'card_credit', label: 'Credit Card', icon: '💳' },
  { type: 'card_debit', label: 'Debit Card', icon: '💳' },
]

function keyFor(label: string, type: PaymentMethodType) {
  return `${type}:${label}`
}

export function StepPaymentMethods({ draft, updateDraft }: OnboardingStepProps) {
  const [custom, setCustom] = useState('')

  const selectedKeys = new Set(draft.paymentMethods.map((p) => keyFor(p.name, p.type)))

  function toggle(label: string, type: PaymentMethodType) {
    const k = keyFor(label, type)
    if (selectedKeys.has(k)) {
      updateDraft({
        paymentMethods: draft.paymentMethods.filter((p) => keyFor(p.name, p.type) !== k),
      })
      return
    }
    updateDraft({ paymentMethods: [...draft.paymentMethods, { name: label, type }] })
  }

  function addCustom() {
    const name = custom.trim()
    if (!name) return
    const k = keyFor(name, 'other')
    if (!selectedKeys.has(k)) {
      updateDraft({ paymentMethods: [...draft.paymentMethods, { name, type: 'other' }] })
    }
    setCustom('')
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 flex-1 flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {OPTIONS.map(({ type, label, icon }) => {
          const on = selectedKeys.has(keyFor(label, type))
          return (
            <button
              key={keyFor(label, type)}
              type="button"
              onClick={() => toggle(label, type)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                on ?
                  'border-[#E50914] bg-[#E50914]/10 text-white'
                : 'border-[#2A2A38] text-[#A0A0B8] hover:border-[#5A5A72]',
              )}
            >
              <span className="text-xl" aria-hidden>
                {icon}
              </span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pm-custom" className="text-xs text-[#5A5A72]">
          + Add custom
        </label>
        <div className="flex gap-2">
          <Input
            id="pm-custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            placeholder="e.g. Apple Pay"
            className="flex-1 bg-[#111118] border-[#2A2A38] text-white rounded-xl"
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-4 py-2 rounded-xl bg-[#1A1A24] border border-[#2A2A38] text-sm text-white hover:border-[#E50914]"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
