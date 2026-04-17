import type { Dictionary } from '@/lib/i18n/types'
import type { SurveyConfig } from '@/lib/onboarding/surveyConfig'

/**
 * Six-step onboarding for guests. Minimal by design — just enough for the app
 * to feel personalised. Full expert onboarding still runs if they promote
 * themselves to an authenticated account later.
 *
 * Step order matches the `mapsTo` fields already consumed by `applyMapsTo` and
 * `valueForSingleStep` so the existing submission machinery works unchanged.
 */
export function getGuestSurveyConfig(t: Dictionary, defaultNickname: string): SurveyConfig {
  const o = t.onboarding
  return {
    steps: [
      {
        id: 'display_name',
        type: 'text',
        title: o.displayNameTitle,
        placeholder: o.displayNamePlaceholder,
        mapsTo: 'profile.name',
        maxLength: 80,
        defaultValue: defaultNickname,
        helpText: o.displayNameHelp,
      },
      {
        id: 'gender',
        type: 'single_select',
        title: o.genderTitle,
        mapsTo: 'profile.gender',
        helpText: o.genderHelp,
        options: [
          { value: 'male', label: o.genderMale },
          { value: 'female', label: o.genderFemale },
          { value: 'prefer_not_to_say', label: o.genderPreferNot },
        ],
      },
      {
        id: 'country',
        type: 'country_select',
        title: o.countryTitle,
        placeholder: o.countryPlaceholder,
        mapsTo: 'profile.country',
        helpText: o.countryHelp,
      },
      {
        id: 'city',
        type: 'text',
        title: o.cityTitle,
        placeholder: o.cityPlaceholder,
        mapsTo: 'profile.city',
        maxLength: 80,
        helpText: o.cityHelp,
      },
      {
        id: 'base_currency',
        type: 'single_select',
        title: o.baseCurrencyTitle,
        mapsTo: 'settings.baseCurrency',
        helpText: o.baseCurrencyHelp,
        options: [
          { value: 'AED', label: o.currencyAed },
          { value: 'USD', label: o.currencyUsd },
          { value: 'EGP', label: o.currencyEgp },
          { value: 'EUR', label: o.currencyEur },
          { value: 'GBP', label: o.currencyGbp },
          { value: 'SAR', label: o.currencySar },
        ],
      },
      {
        id: 'secondary_currency',
        type: 'single_select',
        title: o.secondaryCurrencyTitle,
        mapsTo: 'settings.secondaryCurrency',
        helpText: o.secondaryCurrencyHelp,
        options: [
          { value: 'none', label: o.secondaryCurrencyNone },
          { value: 'AED', label: o.currencyAed },
          { value: 'USD', label: o.currencyUsd },
          { value: 'EGP', label: o.currencyEgp },
          { value: 'EUR', label: o.currencyEur },
          { value: 'GBP', label: o.currencyGbp },
          { value: 'SAR', label: o.currencySar },
        ],
      },
    ],
  }
}
