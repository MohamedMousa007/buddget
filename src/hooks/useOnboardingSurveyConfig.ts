'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'
import { type SurveyConfig } from '@/lib/onboarding/surveyConfig'
import { getExpertSurveyConfig } from '@/lib/onboarding/expertSurveyConfig'
import { pickSurveyConfig } from '@/lib/onboarding/onboardingPageHelpers'

export function useOnboardingSurveyConfig() {
  const t = useT()
  const supabase = useMemo(() => createClient(), [])
  const [config, setConfig] = useState<SurveyConfig>(() => getExpertSurveyConfig(t))
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
        setConfig(getExpertSurveyConfig(t))
        return
      }
      setLoadError(null)
      setConfig(pickSurveyConfig(data?.config, t))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, t])

  return { supabase, config, loadError }
}
