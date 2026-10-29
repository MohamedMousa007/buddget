'use client'

import { useEffect, useState } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import type { UserProfile } from '@/lib/store/types'
import { OptionChip } from '@/components/ui/OptionChip'

type FoodFrequency = NonNullable<UserProfile['foodFrequency']>
type TransportMode = NonNullable<UserProfile['transportMode']>
type LifestyleTier = NonNullable<UserProfile['lifestyleTier']>

/**
 * Dashboard lifestyle picker. Feeds the AI Build-My-Budget action with the
 * three scaling signals (food frequency, main transport mode, lifestyle tier)
 * that the onboarding questionnaire used to collect ephemerally. Writes straight
 * through to `profile` via `updateProfile` so data persists + syncs.
 */
export function LifestyleSheet() {
  const profile = useFinanceStore((s) => s.profile)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'lifestyle'

  const [food, setFood] = useState<FoodFrequency | null>(profile.foodFrequency ?? null)
  const [transport, setTransport] = useState<TransportMode | null>(profile.transportMode ?? null)
  const [tier, setTier] = useState<LifestyleTier | null>(profile.lifestyleTier ?? null)

  // Re-seed from the store every time the sheet opens so edits made elsewhere
  // show up on the form.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync from store on open */
    if (isOpen) {
      setFood(profile.foodFrequency ?? null)
      setTransport(profile.transportMode ?? null)
      setTier(profile.lifestyleTier ?? null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, profile.foodFrequency, profile.transportMode, profile.lifestyleTier])

  const canSave = !!(food && transport && tier)

  const handleSave = () => {
    if (!canSave) return
    updateProfile({ foodFrequency: food, transportMode: transport, lifestyleTier: tier })
    setActiveModal(null)
  }

  useEscapeClose(isOpen, () => setActiveModal(null))

  return (
    <ModalShell open={isOpen} onBackdropClick={() => setActiveModal(null)} padContent>
      <div className="p-5">
        <V3SheetHeader title={t.onboarding.lifestyleTitle} onClose={() => setActiveModal(null)} />
        <p className="text-xs text-[var(--color-brand-text-muted)] mb-4 -mt-1">
          {t.onboarding.lifestyleSubtitle}
        </p>

        <PickerGroup
          label={t.onboarding.lifestyleLabelFood}
          value={food}
          onChange={setFood}
          options={[
            { value: 'everyday', label: t.onboarding.lifestyleFoodEveryday },
            { value: 'mostdays', label: t.onboarding.lifestyleFoodMostdays },
            { value: 'sometimes', label: t.onboarding.lifestyleFoodSometimes },
            { value: 'rarely', label: t.onboarding.lifestyleFoodRarely },
          ]}
        />

        <PickerGroup
          label={t.onboarding.lifestyleLabelTransport}
          value={transport}
          onChange={setTransport}
          options={[
            { value: 'public', label: t.onboarding.lifestyleTransportPublic },
            { value: 'car', label: t.onboarding.lifestyleTransportCar },
            { value: 'taxi', label: t.onboarding.lifestyleTransportTaxi },
            { value: 'walk', label: t.onboarding.lifestyleTransportWalk },
          ]}
        />

        <PickerGroup
          label={t.onboarding.lifestyleLabelTier}
          value={tier}
          onChange={setTier}
          options={[
            { value: 'minimal', label: t.onboarding.lifestyleTierMinimal },
            { value: 'balanced', label: t.onboarding.lifestyleTierBalanced },
            { value: 'comfortable', label: t.onboarding.lifestyleTierComfortable },
          ]}
        />

        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          size="touch"
          className="mt-2 w-full text-sm font-semibold"
        >
          {t.onboarding.lifestyleSave}
        </Button>
      </div>
    </ModalShell>
  )
}

function PickerGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T | null
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-[var(--color-brand-text-secondary)] mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <OptionChip
              key={opt.value}
              size="segment"
              selected={active}
              onClick={() => onChange(opt.value)}
              className="min-h-10 justify-start text-start text-sm"
            >
              {opt.label}
            </OptionChip>
          )
        })}
      </div>
    </div>
  )
}
