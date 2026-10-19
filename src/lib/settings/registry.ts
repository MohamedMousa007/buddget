import type { AppSettings } from '@/lib/store/types'

export type RoomId = 'you' | 'money' | 'alerts' | 'buddgy' | 'look' | 'data' | 'help'

export const ROOM_IDS: readonly RoomId[] = ['you', 'money', 'alerts', 'buddgy', 'look', 'data', 'help']

export const ROOM_ROUTE: Record<RoomId, string> = {
  you: '/settings/you',
  money: '/settings/money',
  alerts: '/settings/alerts',
  buddgy: '/settings/buddgy',
  look: '/settings/look',
  data: '/settings/data',
  help: '/settings/help',
}

export const SETTING_IDS = [
  'profile', 'account', 'password', 'twoFactor', 'biometric', 'deleteAccount', 'paymentMethods',
  'baseCurrency', 'secondaryCurrency', 'onlyMyCurrencies', 'converter', 'payCycle',
  'household', 'lifestyle', 'budgetEntryMode', 'goldStrip',
  'subDueReminders', 'subPriceAlerts', 'goalProgressAlerts', 'goalAlerts', 'pushStatus',
  'tips', 'learning', 'memories', 'voiceReadAloud', 'sms',
  'theme', 'language', 'showCents',
  'exportData', 'restoreBackup', 'resetTips', 'startFresh',
  'feedback', 'terms', 'privacy',
] as const

export type SettingId = (typeof SETTING_IDS)[number]

/** `toggle` flips in place, `value` shows its current value, `nav` opens something, `danger` is destructive. */
export type SettingKind = 'toggle' | 'value' | 'nav' | 'danger'

/** Opens a sheet instead of a page. */
export type SettingAction = 'paymentMethods' | 'household' | 'lifestyle' | 'resetTips'

export type SettingIconKey =
  | 'user' | 'shield' | 'key' | 'lock' | 'trash' | 'card' | 'coins' | 'swap' | 'calendar' | 'home' | 'chart'
  | 'bell' | 'target' | 'repeat' | 'buddgy' | 'mic' | 'message' | 'sun' | 'globe' | 'download' | 'upload'
  | 'refresh' | 'help' | 'file'

export interface SettingEntry {
  id: SettingId
  room: RoomId
  kind: SettingKind
  /** Page that holds the control. */
  route: string
  icon: SettingIconKey
  action?: SettingAction
  /** Hide from users who aren't signed in. */
  needsAuth?: boolean
}

const e = (
  id: SettingId, room: RoomId, kind: SettingKind, route: string, icon: SettingIconKey,
  extra: Pick<SettingEntry, 'action' | 'needsAuth'> = {},
): SettingEntry => ({ id, room, kind, route, icon, ...extra })

export const SETTINGS_REGISTRY: readonly SettingEntry[] = [
  e('profile', 'you', 'nav', '/settings/you', 'user'),
  e('account', 'you', 'nav', '/settings/you', 'shield', { needsAuth: true }),
  e('password', 'you', 'nav', '/settings/you', 'key', { needsAuth: true }),
  e('twoFactor', 'you', 'toggle', '/settings/you', 'shield', { needsAuth: true }),
  e('biometric', 'you', 'nav', '/settings/you', 'lock', { needsAuth: true }),
  e('deleteAccount', 'you', 'danger', '/settings/you', 'trash', { needsAuth: true }),
  e('paymentMethods', 'money', 'nav', '/settings/money', 'card', { action: 'paymentMethods' }),
  e('baseCurrency', 'money', 'value', '/settings/money', 'coins'),
  e('secondaryCurrency', 'money', 'toggle', '/settings/money', 'swap'),
  e('onlyMyCurrencies', 'money', 'toggle', '/settings/money', 'coins'),
  e('converter', 'money', 'nav', '/settings/money', 'swap'),
  e('payCycle', 'money', 'value', '/settings/money', 'calendar'),
  e('household', 'money', 'nav', '/settings/money', 'home', { action: 'household' }),
  e('lifestyle', 'money', 'nav', '/settings/money', 'home', { action: 'lifestyle' }),
  e('budgetEntryMode', 'money', 'value', '/settings/money', 'chart'),
  e('goldStrip', 'money', 'toggle', '/settings/money', 'coins'),
  e('subDueReminders', 'alerts', 'toggle', '/settings/alerts', 'repeat'),
  e('subPriceAlerts', 'alerts', 'toggle', '/settings/alerts', 'repeat'),
  e('goalProgressAlerts', 'alerts', 'toggle', '/settings/alerts', 'target'),
  e('goalAlerts', 'alerts', 'toggle', '/settings/alerts', 'target'),
  e('pushStatus', 'alerts', 'value', '/settings/alerts', 'bell'),
  e('tips', 'buddgy', 'toggle', '/settings/buddgy', 'buddgy'),
  e('learning', 'buddgy', 'toggle', '/settings/buddgy', 'buddgy'),
  e('memories', 'buddgy', 'nav', '/settings/buddgy', 'buddgy'),
  e('voiceReadAloud', 'buddgy', 'toggle', '/settings/buddgy', 'mic'),
  e('sms', 'buddgy', 'nav', '/settings/buddgy', 'message', { needsAuth: true }),
  e('theme', 'look', 'value', '/settings/look', 'sun'),
  e('language', 'look', 'value', '/settings/look', 'globe'),
  e('showCents', 'look', 'toggle', '/settings/look', 'coins'),
  e('exportData', 'data', 'nav', '/settings/data', 'download'),
  e('restoreBackup', 'data', 'nav', '/settings/data', 'upload'),
  e('resetTips', 'data', 'nav', '/settings/data', 'refresh', { action: 'resetTips' }),
  e('startFresh', 'data', 'danger', '/settings/data', 'trash'),
  e('feedback', 'help', 'nav', '/settings/help', 'help'),
  e('terms', 'help', 'nav', '/legal/terms', 'file'),
  e('privacy', 'help', 'nav', '/legal/privacy', 'file'),
]

export const SETTING_BY_ID: Readonly<Record<SettingId, SettingEntry>> = Object.fromEntries(
  SETTINGS_REGISTRY.map((s) => [s.id, s]),
) as Record<SettingId, SettingEntry>

/**
 * Every AppSettings key is either reachable from search (mapped to its entry) or explicitly internal.
 * The `Record<keyof AppSettings, …>` type makes adding a key a compile error until it is placed here.
 */
export const APP_SETTING_COVERAGE: Record<keyof AppSettings, SettingId | 'internal'> = {
  baseCurrency: 'baseCurrency',
  secondaryCurrency: 'secondaryCurrency',
  showSecondaryCurrency: 'secondaryCurrency',
  theme: 'theme',
  language: 'language',
  showCentsInDashboard: 'showCents',
  monthStartDay: 'payCycle',
  budgetEntryMode: 'budgetEntryMode',
  enableAI: 'internal',
  aiProvider: 'internal',
  noIncomeDeclared: 'internal',
  showAllCurrenciesInForms: 'onlyMyCurrencies',
  twoFactorEmailEnabled: 'twoFactor',
  legacyOnboardingMigratedAt: 'internal',
  dashboardLayout: 'internal',
  wealthGoldStrip: 'goldStrip',
  tutorialsCompleted: 'internal',
  tutorialCurrentStep: 'internal',
  smsTrackingEnabled: 'sms',
  subDueReminders: 'subDueReminders',
  subPriceAlerts: 'subPriceAlerts',
  goalProgressAlerts: 'goalProgressAlerts',
  goalAlerts: 'goalAlerts',
}
