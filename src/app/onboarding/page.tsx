'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  DEFAULT_SURVEY_CONFIG,
  parseSurveyConfig,
  type SurveyConfig,
  type SurveyStep,
} from '@/lib/onboarding/surveyConfig'
import type { AppSettings, Currency, UserProfile } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { PAGE_HEADER_SURFACE_CLASS } from '@/components/layout/PageHeader'

function applyMapsTo(
  mapsTo: string,
  value: string,
  updateProfile: (u: Partial<UserProfile>) => void,
  updateSettings: (u: Partial<AppSettings>) => void
) {
  if (mapsTo === 'profile.name') {
    updateProfile({ name: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'settings.baseCurrency') {
    updateSettings({ baseCurrency: value as Currency })
    return
  }
  if (mapsTo === 'settings.secondaryCurrency') {
    if (value === 'none') {
      updateSettings({ secondaryCurrency: null, showSecondaryCurrency: false })
    } else {
      updateSettings({
        secondaryCurrency: value as Currency,
        showSecondaryCurrency: true,
      })
    }
  }
}

function StepBody({
  step,
  textValue,
  setTextValue,
  selected,
  setSelected,
}: {
  step: SurveyStep
  textValue: string
  setTextValue: (v: string) => void
  selected: string | null
  setSelected: (v: string) => void
}) {
  if (step.type === 'static') {
    return <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">{step.body}</p>
  }
  if (step.type === 'text') {
    return (
      <Input
        value={textValue}
        maxLength={step.maxLength ?? 120}
        placeholder={step.placeholder ?? ''}
        onChange={(e) => setTextValue(e.target.value)}
        className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
      />
    )
  }
  return (
    <div className="grid gap-2">
      {step.options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSelected(opt.value)}
          className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
            selected === opt.value
              ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-white'
              : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)]/40'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

type StepContinuePayload = { textValue: string; selected: string | null }

/**
 * Owns text/select state per step. `key={step.id}` on the parent remounts this
 * when the step changes — no useEffect reset needed (eslint react-hooks/set-state-in-effect).
 */
function OnboardingStepPanel({
  step,
  loadError,
  isLastStep,
  finishing,
  onContinue,
}: {
  step: SurveyStep
  loadError: string | null
  isLastStep: boolean
  finishing: boolean
  onContinue: (payload: StepContinuePayload) => void | Promise<void>
}) {
  const [textValue, setTextValue] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const canContinue = useMemo(() => {
    if (step.type === 'static') return true
    if (step.type === 'text') return textValue.trim().length > 0
    return !!selected
  }, [step.type, textValue, selected])

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2 }}
      className="glass-card rounded-2xl p-6 w-full max-w-lg flex flex-col gap-6 self-center"
    >
      <div>
        <h2 className="text-xl font-bold text-white font-heading mb-2">{step.title}</h2>
        {loadError ? (
          <p className="text-[11px] text-amber-200/90 mb-2">
            Could not load remote survey ({loadError}). Using default steps.
          </p>
        ) : null}
      </div>

      <StepBody
        step={step}
        textValue={textValue}
        setTextValue={setTextValue}
        selected={selected}
        setSelected={setSelected}
      />

      <button
        type="button"
        disabled={!canContinue || finishing}
        onClick={() => void onContinue({ textValue, selected })}
        className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {finishing ? 'Finishing…' : isLastStep ? 'Finish' : 'Continue'}
        {!finishing ? <ChevronRight className="w-4 h-4" /> : null}
      </button>
    </motion.div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  const [config, setConfig] = useState<SurveyConfig>(DEFAULT_SURVEY_CONFIG)
  const [index, setIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('onboarding_survey_config')
        .select('config')
        .eq('published', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setConfig(DEFAULT_SURVEY_CONFIG)
        return
      }
      if (data?.config) {
        setConfig(parseSurveyConfig(data.config))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const steps = config.steps
  const step = steps[index]

  const handleStepContinue = useCallback(
    async ({ textValue, selected }: StepContinuePayload) => {
      if (!step) return

      if (step.type === 'text') {
        applyMapsTo(step.mapsTo, textValue.trim() || 'Friend', updateProfile, updateSettings)
      }
      if (step.type === 'single_select') {
        if (!selected) return
        applyMapsTo(step.mapsTo, selected, updateProfile, updateSettings)
      }

      if (index >= steps.length - 1) {
        setFinishing(true)
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setFinishing(false)
          router.replace('/login')
          return
        }

        await supabase
          .from('user_profiles')
          .update({
            onboarding_completed: true,
            display_name: useFinanceStore.getState().profile.name,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        await supabase.auth.updateUser({
          data: { onboarding_completed: true },
        })

        router.refresh()
        router.replace('/')
        return
      }

      setIndex((i) => i + 1)
    },
    [index, router, step, steps.length, supabase, updateProfile, updateSettings]
  )

  if (!step) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white">
        <p className="text-sm text-[var(--color-brand-text-muted)]">Loading onboarding…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={PAGE_HEADER_SURFACE_CLASS}>
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--color-brand-red)]" />
            <div>
              <h1 className="text-lg font-bold text-white font-heading">Setup</h1>
              <p className="text-[11px] text-[var(--color-brand-text-muted)]">
                Step {index + 1} of {steps.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-stretch justify-center p-4 pb-10">
        <AnimatePresence mode="wait">
          <OnboardingStepPanel
            key={step.id ?? `step-${index}`}
            step={step}
            loadError={loadError}
            isLastStep={index >= steps.length - 1}
            finishing={finishing}
            onContinue={handleStepContinue}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}
