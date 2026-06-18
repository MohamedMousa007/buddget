'use client'

import { useMemo } from 'react'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useRates } from '@/hooks/useRates'
import { useSmsTracking } from '@/hooks/useSmsTracking'
import { buildIncomeRangeLabels } from '@/components/features/onboarding/incomeRanges'
import { isNative, isIOS } from '@/lib/native/isNative'
import { Switch } from '@/components/ui/switch'
import { SmsIosSetupCard } from '@/components/features/settings/SmsIosSetupCard'
import type { Currency } from '@/lib/store/types'
import type { IncomeRangeKey, MoneyManagementMethod, SpendingCategory, OnboardingState } from '@/hooks/useOnboarding'

interface StepSpendingProps {
  state: OnboardingState
  onIncomeRangeSelect: (r: IncomeRangeKey) => void
  onManagementSelect: (m: MoneyManagementMethod) => void
  onToggleCategory: (c: SpendingCategory) => void
  onToggleSms: (v: boolean) => void
  onNext: () => void
}

const INCOME_RANGES: IncomeRangeKey[] = ['under_1k', '1k_3k', '3k_7k', '7k_15k', '15k_plus']
const MGMT_METHODS: MoneyManagementMethod[] = ['spreadsheet', 'another_app', 'in_my_head', 'dont_track']
const CATEGORY_ICONS: Record<SpendingCategory, string> = {
  food: '🍔', transport: '🚗', housing: '🏠', health: '💊',
  entertainment: '🎬', shopping: '🛍️', travel: '✈️', education: '📚',
}
const CATEGORIES: SpendingCategory[] = [
  'food', 'transport', 'housing', 'health',
  'entertainment', 'shopping', 'travel', 'education',
]

/**
 * Step 3 — spending profile: income range, money management method,
 * spending categories, and SMS tracking preference.
 */
export function StepSpending({
  state,
  onIncomeRangeSelect,
  onManagementSelect,
  onToggleCategory,
  onToggleSms,
  onNext,
}: StepSpendingProps) {
  const t = useT()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
          {t.onboarding.spendingProfileTitle}
        </h2>
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1">
          {t.onboarding.spendingProfileSubtitle}
        </p>
      </div>

      <IncomeRangeField selected={state.incomeRange} onSelect={onIncomeRangeSelect} currency={state.currency} t={t} />
      <ManagementField selected={state.moneyManagementMethod} onSelect={onManagementSelect} t={t} />
      <CategoriesField selected={state.spendingCategories} onToggle={onToggleCategory} t={t} />
      <SmsTrackingField onToggleSms={onToggleSms} t={t} />

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-xl font-medium text-sm transition-colors bg-[var(--color-brand-red)] text-white hover:opacity-90 flex items-center justify-center gap-2"
      >
        {t.onboarding.continueButton}
        <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
      </button>
    </div>
  )
}

function IncomeRangeField({
  selected,
  onSelect,
  currency,
  t,
}: {
  selected: IncomeRangeKey | ''
  onSelect: (r: IncomeRangeKey) => void
  currency: Currency
  t: ReturnType<typeof useT>
}) {
  const { exchangeRates } = useRates()
  const labels = useMemo(
    () => buildIncomeRangeLabels(currency, exchangeRates, t.onboarding),
    [currency, exchangeRates, t],
  )

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.onboarding.incomeRangeLabel}
      </label>
      <div className="flex flex-col gap-2">
        {INCOME_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(r)}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium border text-start transition-colors ${selected === r ? 'bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
          >
            {labels[r]}
          </button>
        ))}
      </div>
    </div>
  )
}

function ManagementField({
  selected,
  onSelect,
  t,
}: {
  selected: MoneyManagementMethod | ''
  onSelect: (m: MoneyManagementMethod) => void
  t: ReturnType<typeof useT>
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.onboarding.moneyManagementLabel}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {MGMT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${selected === m ? 'bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] hover:border-[var(--color-brand-red)]/50'}`}
          >
            {t.onboarding.moneyManagementLabels[m]}
          </button>
        ))}
      </div>
    </div>
  )
}

function CategoriesField({
  selected,
  onToggle,
  t,
}: {
  selected: SpendingCategory[]
  onToggle: (c: SpendingCategory) => void
  t: ReturnType<typeof useT>
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.onboarding.categoriesLabel}
      </label>
      <div className="grid grid-cols-4 gap-2">
        {CATEGORIES.map((c) => {
          const active = selected.includes(c)
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className={`rounded-xl border py-2.5 flex flex-col items-center gap-1 transition-colors ${active ? 'bg-[var(--color-brand-red)]/10 border-[var(--color-brand-red)]' : 'bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] hover:border-[var(--color-brand-red)]/50'}`}
            >
              <span className="text-base" aria-hidden>{CATEGORY_ICONS[c]}</span>
              <span className="text-[10px] font-medium text-[var(--color-brand-text-primary)] leading-none">
                {t.onboarding.categoryLabels[c]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * SMS tracking — mirrors the real Settings flow (SettingsSmsTrackingSection):
 * Android requests the OS permission and arms the bridge on grant; iOS shows the
 * Shortcut setup card and arms on completion; web just persists the preference.
 * `onToggleSms` syncs the onboarding-local flag so the review step reflects it.
 */
function SmsTrackingField({
  onToggleSms,
  t,
}: {
  onToggleSms: (v: boolean) => void
  t: ReturnType<typeof useT>
}) {
  const { isEnabled, isSetup, toggle, completeIosSetup, loading, error, lastReceivedAt } = useSmsTracking()
  const onIOS = isNative() && isIOS()
  const showSwitch = isSetup // iOS hides the switch until the Shortcut guide is finished

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">
              {t.onboarding.smsTrackingLabel}
            </p>
            <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 leading-relaxed">
              {t.onboarding.smsTrackingHint}
            </p>
          </div>
          {showSwitch && (
            <Switch
              checked={isEnabled}
              disabled={loading}
              onCheckedChange={async (v) => {
                await toggle(v)
                onToggleSms(v)
              }}
            />
          )}
        </div>

        {/* iOS, not yet set up: show the Shortcut setup card (no switch). */}
        {onIOS && !isSetup && (
          <SmsIosSetupCard
            lastReceivedAt={lastReceivedAt}
            onSetupComplete={async () => {
              await completeIosSetup()
              onToggleSms(true)
            }}
          />
        )}

        {/* iOS, set up & enabled: re-open guide / status pill. */}
        {onIOS && isSetup && isEnabled && (
          <SmsIosSetupCard lastReceivedAt={lastReceivedAt} onSetupComplete={completeIosSetup} />
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
