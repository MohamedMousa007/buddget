'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { migrateLegacyNotes } from '@/lib/ai/memoryActions'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useWeekStart } from '@/hooks/useWeekStart'
import type { WeekStartDay } from '@/lib/time/weekStart'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { AppSettings, FinancialProfile, UserProfile } from '@/lib/store/types'

type EntryMode = AppSettings['budgetEntryMode']

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span className="text-sm text-[var(--color-brand-text-secondary)]">{label}</span>
      <span className="text-end text-sm font-semibold text-[var(--color-brand-text-primary)]">{value}</span>
    </div>
  )
}

const bool = (v: boolean | undefined, w: { yes: string; no: string; notSet: string }) => (v === undefined ? w.notSet : v ? w.yes : w.no)

/** Everything Buddgy knows about the person's money, in parts: household, budget answers, what it learned, and setup questions. */
export default function SettingsMemoryPage() {
  const copy = useSettingsHubCopy()
  const m = copy.memory
  const { locale } = useLocale()
  const w = useT().inlineCopy.memoryWords
  const profile = useFinanceStore((s) => s.profile) as UserProfile
  const settings = useFinanceStore((s) => s.settings)
  const weekStart = useWeekStart()
  const memories = useFinanceStore((s) => s.buddgyMemories)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const forget = useFinanceStore((s) => s.removeBuddgyMemory)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const tone = GROUP_TONE.memory
  const fp: FinancialProfile = profile.financialProfile ?? {}

  useEffect(migrateLegacyNotes, [])

  const answers: Array<[string, string]> = [
    [w.housingLabel, fp.housing ? w.housing[fp.housing] : w.notSet],
    [w.dependents, fp.dependents === undefined ? w.notSet : String(fp.dependents)],
    [w.supports, bool(fp.supportsOthers, w)],
    [w.income, fp.incomeStability ? w.stability[fp.incomeStability] : w.notSet],
    [w.car, bool(fp.hasCar, w)],
    [w.lean, fp.securityLean === undefined ? w.notSet : `${fp.securityLean}%`],
    [w.invest, bool(fp.investInterest, w)],
  ]
  const answered = answers.filter(([, v]) => v !== w.notSet)
  const learned = memories.filter((x) => x.status === 'active')
  const sourceLabel = (s: 'budget' | 'chat' | 'settings') => (s === 'budget' ? m.source.budget : s === 'chat' ? m.source.chat : m.source.manual)

  return (
    <SettingsSubPageShell title={m.title}>
      <p className="px-1 text-sm text-[var(--color-brand-text-muted)]">{m.intro}</p>

      <SettingsSection title={m.household}>
        <SettingsRow
          icon={SETTING_ICONS.home}
          tone={tone}
          title={copy.items.household.label}
          subtitle={[profile.household ? w.household[profile.household] : m.householdEmpty, profile.monthlyRent ? `${w.rent}: ${profile.monthlyRent.toLocaleString('en-US')} ${settings.baseCurrency}` : null].filter(Boolean).join(' · ')}
          onClick={() => setActiveModal('householdRent')}
          settingId="household"
        />
        <SettingsRow
          icon={SETTING_ICONS.home}
          tone={tone}
          title={copy.items.lifestyle.label}
          subtitle={[profile.lifestyleTier ? w.tier[profile.lifestyleTier] : null, profile.foodFrequency ? w.food[profile.foodFrequency] : null, profile.transportMode ? w.transport[profile.transportMode] : null].filter(Boolean).join(' · ') || m.householdEmpty}
          onClick={() => setActiveModal('lifestyle')}
          settingId="lifestyle"
        />
      </SettingsSection>

      <SettingsSection title={m.budget}>
        <div data-setting-id="budgetEntryMode" className="space-y-2.5 px-4 py-3">
          <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{m.entry}</span>
          <SegmentedControl<EntryMode>
            ariaLabel={m.entry}
            value={settings.budgetEntryMode}
            onChange={(budgetEntryMode) => updateSettings({ budgetEntryMode })}
            options={[
              { value: 'amount', label: m.entryAmount },
              { value: 'percent_of_income', label: m.entryPercent },
            ]}
          />
        </div>
        <div data-setting-id="weekStart" className="space-y-2.5 px-4 py-3">
          <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{m.weekStart}</span>
          <SegmentedControl<`${WeekStartDay}`>
            ariaLabel={m.weekStart}
            value={`${weekStart}`}
            onChange={(v) => updateSettings({ weekStartDay: Number(v) as WeekStartDay })}
            options={[
              { value: '6', label: m.weekSat },
              { value: '0', label: m.weekSun },
              { value: '1', label: m.weekMon },
            ]}
          />
        </div>
        <SettingsToggleRow id="goldStrip" tone={tone} hint={m.goldHint} />
        {answered.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
      </SettingsSection>

      <section className="space-y-2">
        <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{m.learned}</p>
        {learned.length === 0 ? (
          <Card padding="md" className="text-sm text-[var(--color-brand-text-muted)]">{m.learnedEmpty}</Card>
        ) : (
          (['fact', 'preference', 'constraint'] as const).map((kind) => {
            const items = learned.filter((x) => x.kind === kind)
            if (!items.length) return null
            return (
              <Card key={kind} padding="none" divide className="overflow-hidden">
                <p className="px-4 pt-3 text-xs font-semibold text-[var(--color-brand-text-secondary)]">{w.kinds[kind]}</p>
                {items.map((x) => (
                  <div key={x.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[var(--color-brand-text-primary)]">{x.text}</span>
                      <span className="block text-xs text-[var(--color-brand-text-muted)]">{sourceLabel(x.source)} · {new Date(x.updatedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US')}</span>
                    </span>
                    <IconButton onClick={() => forget(x.id)} aria-label={m.forget} size="sm" shape="round"><X className="h-3.5 w-3.5" /></IconButton>
                  </div>
                ))}
              </Card>
            )
          })
        )}
      </section>

      <Card padding="md" className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{m.onboarding}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{m.onboardingEmpty}</p>
      </Card>
    </SettingsSubPageShell>
  )
}
