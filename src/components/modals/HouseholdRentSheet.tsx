'use client'

import { useEffect, useState } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import type { UserProfile } from '@/lib/store/types'
import { OptionChip } from '@/components/ui/OptionChip'

type Household = NonNullable<UserProfile['household']>

/**
 * Dashboard picker for household composition + monthly rent. These drive the
 * AI Build-My-Budget action's fixed-cost baseline. Writes straight to
 * `profile` via `updateProfile`.
 */
export function HouseholdRentSheet() {
  const profile = useFinanceStore((s) => s.profile)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
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
        <V3SheetHeader title={t.onboarding.householdTitle} onClose={() => setActiveModal(null)} />
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
                <OptionChip
                  key={opt.value}
                  size="segment"
                  selected={active}
                  onClick={() => setHousehold(opt.value)}
                  className="h-10 text-sm"
                >
                  {opt.label}
                </OptionChip>
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

        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          size="touch"
          className="w-full text-sm font-semibold"
        >
          {t.onboarding.householdSave}
        </Button>
      </div>
    </ModalShell>
  )
}
