'use client'

import { Preferences } from '@capacitor/preferences'
import { isNative, getPlatform } from '@/lib/native/isNative'

/** Snapshot serialised into the shared App Group (iOS) / SharedPreferences (Android). */
export interface WidgetSnapshot {
  /** Currency code displayed in the widget hero (Egypt-first default: EGP). */
  currency: string
  /** Spent so far this month, in `currency`. */
  spentThisMonth: number
  /** Configured monthly budget in `currency` (0 if unset). */
  monthlyBudget: number
  /** Top-3 expense categories with totals for the bar chart in the widget. */
  topCategories: Array<{ category: string; amount: number }>
  /** Latest expense — surface in the small/extra-small variant. */
  latestExpense: {
    description: string
    amount: number
    currency: string
    date: string
  } | null
  /** Locale for number/date formatting (e.g. `en-EG`, `ar-EG`). */
  locale: string
  /** ISO timestamp for the snapshot — widget shows "Updated X ago". */
  updatedAt: string
}

const SHARED_KEY = 'buddget.widget.snapshot.v1'

/**
 * Writes a JSON snapshot to the OS-shared keystore so the iOS WidgetKit and
 * Android Glance widgets can render the latest figures without launching the
 * full WebView. Safe to call on the web — becomes a no-op outside Capacitor.
 *
 * iOS: data is read natively via the App Group declared in `capacitor.config.ts`
 * (`group.online.buddget`).
 * Android: the bridged `BuddgetWidgetUpdater` plugin reads the same JSON and
 * triggers `AppWidgetManager.updateAppWidget`. See `docs/WIDGET_SETUP.md` for
 * the Kotlin implementation.
 */
export async function updateWidgetData(snapshot: WidgetSnapshot): Promise<void> {
  if (!isNative()) return
  try {
    const json = JSON.stringify(snapshot)
    await Preferences.set({ key: SHARED_KEY, value: json })
    if (getPlatform() === 'android') {
      await pingAndroidWidget()
    }
  } catch (e) {
    console.warn('[widgetBridge] update failed', e)
  }
}

export async function readWidgetData(): Promise<WidgetSnapshot | null> {
  if (!isNative()) return null
  try {
    const { value } = await Preferences.get({ key: SHARED_KEY })
    if (!value) return null
    return JSON.parse(value) as WidgetSnapshot
  } catch {
    return null
  }
}

interface BuddgetWidgetUpdaterPlugin {
  ping(): Promise<void>
}

async function pingAndroidWidget(): Promise<void> {
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const plugin = registerPlugin<BuddgetWidgetUpdaterPlugin>('BuddgetWidgetUpdater')
    await plugin.ping()
  } catch {
    // Plugin not yet registered in the Android shell — no-op until
    // `docs/WIDGET_SETUP.md` Kotlin is pasted into the project.
  }
}

/**
 * Egypt-first default snapshot used during onboarding before any expenses
 * exist (so the widget never renders an empty grey box).
 */
export const DEFAULT_WIDGET_SNAPSHOT: WidgetSnapshot = {
  currency: 'EGP',
  spentThisMonth: 0,
  monthlyBudget: 0,
  topCategories: [],
  latestExpense: null,
  locale: 'en-EG',
  updatedAt: new Date(0).toISOString(),
}
