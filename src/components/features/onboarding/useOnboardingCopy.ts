import { useLocale } from '@/lib/i18n'
import { onboardingCopyAr, onboardingCopyEn, type OnboardingCopy } from '@/lib/i18n/onboardingCopy'

export function useOnboardingCopy(): OnboardingCopy {
  return useLocale().locale === 'ar' ? onboardingCopyAr : onboardingCopyEn
}
