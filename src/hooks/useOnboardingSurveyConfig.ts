'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type SurveyConfig } from '@/lib/onboarding/surveyConfig'
import { EXPERT_ONBOARDING_CONFIG } from '@/lib/onboarding/expertSurveyConfig'
import { pickSurveyConfig } from '@/lib/onboarding/onboardingPageHelpers'

export function useOnboardingSurveyConfig() {
  const supabase = useMemo(() => createClient(), [])
  const [config, setConfig] = useState<SurveyConfig>(EXPERT_ONBOARDING_CONFIG)
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
        setConfig(EXPERT_ONBOARDING_CONFIG)
        return
      }
      setConfig(pickSurveyConfig(data?.config))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return { supabase, config, loadError }
}
