import { obj, str, oneOf, type ToolSpec } from '@/lib/buddgy/tools/spec'

export const CHANGEABLE_SETTINGS = [
  'theme',
  'language',
  'baseCurrency',
  'secondaryCurrency',
  'showCents',
  'monthStartDay',
  'budgetEntryMode',
  'goldStrip',
  'onlyMyCurrencies',
  'subDueReminders',
  'subPriceAlerts',
  'goalProgressAlerts',
  'goalAlerts',
  'tips',
  'learning',
  'voiceReadAloud',
] as const

export const settingsSpecs: ToolSpec[] = [
  {
    name: 'get_settings',
    domain: 'settings',
    kind: 'read',
    description: 'Current values of the app settings Buddgy can change.',
    params: obj({}),
  },
  {
    name: 'change_setting',
    domain: 'settings',
    kind: 'write',
    risk: 'approve',
    description: 'Propose changing one app setting. Security, SMS and data settings are not changeable here.',
    params: obj(
      {
        setting: oneOf([...CHANGEABLE_SETTINGS]),
        value: str('on|off; light|dark|system; en|ar; currency code (secondaryCurrency also off); day 1-28; amount|percent_of_income'),
      },
      ['setting', 'value'],
    ),
  },
]
