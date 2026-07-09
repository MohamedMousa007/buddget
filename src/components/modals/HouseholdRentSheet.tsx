'use client'

import { useEffect, useState } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/lib/store/types'

type Household = NonNullable<UserProfile['household']>

/**
 * Dashboard picker for household composition + monthly rent. These drive the
 * AI Build-My-Budget action's fixed-cost baseline. Writes straight to
 * `profile` via `updateProfile`.
 */
export function HouseholdRentSheet() {
  const { profile, updateProfile } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'householdRent'

  const [household, setHousehold] = useState<Household | null>(profile.household ?? null)
  const [rent, setRent] = useState<string>(
    profile.monthlyRent != null ? String(profile.monthlyRent) : '',
  )
  const [utilitiesIncluded, setUtilitiesIncluded] = useState<boolean>(
    profile.rentIncludesUtilities ?? false,
  )

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync from store on open */
    if (isOpen) {
      setHousehold(profile.household ?? null)
      setRent(profile.monthlyRent != null ? String(profile.monthlyRent) : '')
      setUtilitiesIncluded(profile.rentIncludesUtilities ?? false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, profile.household, profile.monthlyRent, profile.rentIncludesUtilities])

  const parsedRent = Number(rent)
  const rentValid = rent === '' || (Number.isFinite(parsedRent) && parsedRent >= 0)
  const canSave = !!household && rentValid && rent !== ''

  const handleSave = () => {
    if (!canSave) return
    updateProfile({
      household,
      monthlyRent: parsedRent,
      rentIncludesUtilities: utilitiesIncluded,
    })
    setActiveModal(null)
  }

  useEscapeClose(isOpen, () => setActiveModal(null))

  return (
    <ModalShell open={isOpen} onBackdropClick={() => setActiveModal(null)} padContent>
      <div className="p-5">
        <ModalSheetHeader title={t.onboarding.householdTitle} onClose={() => setActiveModal(null)} />
        <p className="text-xs text-[var(--color-brand-text-muted)] mb-4 -mt-1">
          {t.onboarding.householdSubtitle}
        </p>

        <div className="mb-4">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {t.onboarding.householdLabelSize}
          </Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { value: 'solo', label: t.onboarding.householdSolo },
                { value: 'couple', label: t.onboarding.householdCouple },
                { value: 'family', label: t.onboarding.householdFamily },
              ] as { value: Household; label: string }[]
            ).map((opt) => {
              const active = household === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHousehold(opt.value)}
                  className={cn(
                    'h-10 rounded-xl border text-sm transition-colors',
                    active
                      ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {t.onboarding.householdLabelRent}
          </Label>
          <AmountField
            value={rent}
            onChange={setRent}
            placeholder={t.onboarding.householdRentPlaceholder}
            className="mt-1 flex h-8 items-center rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] px-2.5 text-base text-[var(--color-brand-text-primary)]"
          />
        </div>

        <label className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 cursor-pointer">
          <span className="text-sm text-[var(--color-brand-text-primary)]">
            {t.onboarding.householdUtilitiesIncluded}
          </span>
          <Switch checked={utilitiesIncluded} onCheckedChange={setUtilitiesIncluded} />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="w-full h-11 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-brand-red-hover)] transition-colors"
        >
          {t.onboarding.householdSave}
        </button>
      </div>
    </ModalShell>
  )
}
