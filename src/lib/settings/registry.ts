import type { AppSettings } from '@/lib/store/types'

export type GroupId = 'profile' | 'security' | 'quick' | 'autoTrack' | 'ai' | 'memory' | 'notifications' | 'data' | 'help'

export const SETTING_IDS = [
  'profile', 'password', 'twoFactor', 'biometric', 'appLock', 'deleteAccount',
  'baseCurrency', 'secondaryCurrency', 'converter', 'theme', 'language', 'showCents',
  'sms', 'tips', 'learning', 'memories', 'voiceReadAloud',
  'household', 'lifestyle', 'budgetEntryMode', 'goldStrip',
  'pushStatus', 'subDueReminders', 'subPriceAlerts', 'goalProgressAlerts', 'goalAlerts',
  'notCounted', 'exportData', 'restoreBackup', 'feedback', 'terms', 'privacy', 'about',
] as const

export type SettingId = (typeof SETTING_IDS)[number]

/** `toggle` flips in place, `value` shows its current value, `nav` opens something, `danger` is destructive. */
export type SettingKind = 'toggle' | 'value' | 'nav' | 'danger'

/** Opens a sheet instead of a page. */
export type SettingAction = 'household' | 'lifestyle' | 'currencies' | 'converter' | 'feedback' | 'about' | 'export' | 'deleteAccount' | 'notCounted'

export type SettingIconKey =
  | 'user' | 'shield' | 'key' | 'lock' | 'trash' | 'coins' | 'swap' | 'home' | 'chart' | 'bell' | 'buddgy' | 'mic'
  | 'message' | 'sun' | 'globe' | 'download' | 'upload' | 'help' | 'file' | 'info' | 'brain' | 'target' | 'repeat'

export interface SettingEntry {
  id: SettingId
  group: GroupId
  kind: SettingKind
  /** Page that holds the control. Almost everything sits on the settings page itself. */
  route: string
  icon: SettingIconKey
  action?: SettingAction
  /** Hide from users who aren't signed in. */
  needsAuth?: boolean
}

const e = (
  id: SettingId, group: GroupId, kind: SettingKind, route: string, icon: SettingIconKey,
  extra: Pick<SettingEntry, 'action' | 'needsAuth'> = {},
): SettingEntry => ({ id, group, kind, route, icon, ...extra })

const HUB = '/settings'
const MEMORY = '/settings/memory'
const SECURITY = '/settings/security'

export const SETTINGS_REGISTRY: readonly SettingEntry[] = [
  e('profile', 'profile', 'nav', '/settings/profile', 'user'),
  e('password', 'security', 'nav', SECURITY, 'key', { needsAuth: true }),
  e('twoFactor', 'security', 'toggle', SECURITY, 'shield', { needsAuth: true }),
  e('biometric', 'security', 'toggle', SECURITY, 'lock', { needsAuth: true }),
  e('appLock', 'security', 'toggle', SECURITY, 'lock'),
  e('deleteAccount', 'security', 'danger', SECURITY, 'trash', { needsAuth: true, action: 'deleteAccount' }),
  e('baseCurrency', 'quick', 'value', HUB, 'coins', { action: 'currencies' }),
  e('secondaryCurrency', 'quick', 'value', HUB, 'swap', { action: 'currencies' }),
  e('converter', 'quick', 'nav', HUB, 'swap', { action: 'converter' }),
  e('theme', 'quick', 'toggle', HUB, 'sun'),
  e('language', 'quick', 'toggle', HUB, 'globe'),
  e('showCents', 'quick', 'toggle', HUB, 'coins', { action: 'currencies' }),
  e('sms', 'autoTrack', 'toggle', HUB, 'message', { needsAuth: true }),
  e('tips', 'ai', 'toggle', HUB, 'buddgy'),
  e('learning', 'ai', 'toggle', HUB, 'brain'),
  e('memories', 'ai', 'nav', MEMORY, 'brain'),
  e('voiceReadAloud', 'ai', 'toggle', HUB, 'mic'),
  e('household', 'memory', 'nav', MEMORY, 'home', { action: 'household' }),
  e('lifestyle', 'memory', 'nav', MEMORY, 'home', { action: 'lifestyle' }),
  e('budgetEntryMode', 'memory', 'value', MEMORY, 'chart'),
  e('goldStrip', 'memory', 'toggle', MEMORY, 'coins'),
  e('pushStatus', 'notifications', 'toggle', HUB, 'bell'),
  e('subDueReminders', 'notifications', 'toggle', HUB, 'repeat'),
  e('subPriceAlerts', 'notifications', 'toggle', HUB, 'repeat'),
  e('goalProgressAlerts', 'notifications', 'toggle', HUB, 'target'),
  e('goalAlerts', 'notifications', 'toggle', HUB, 'target'),
  e('notCounted', 'data', 'nav', HUB, 'coins', { action: 'notCounted' }),
  e('exportData', 'data', 'nav', HUB, 'download', { action: 'export' }),
  e('restoreBackup', 'data', 'nav', HUB, 'upload', { action: 'export' }),
  e('feedback', 'help', 'nav', HUB, 'help', { action: 'feedback' }),
  e('terms', 'help', 'nav', '/legal/terms', 'file'),
  e('privacy', 'help', 'nav', '/legal/privacy', 'file'),
  e('about', 'help', 'nav', HUB, 'info', { action: 'about' }),
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
  monthStartDay: 'internal',
  budgetEntryMode: 'budgetEntryMode',
  enableAI: 'internal',
  aiProvider: 'internal',
  noIncomeDeclared: 'internal',
  showAllCurrenciesInForms: 'internal',
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
  privacy: 'internal',
}
