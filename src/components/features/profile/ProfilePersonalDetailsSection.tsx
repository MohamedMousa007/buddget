'use client'

import type { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT, useLocale } from '@/lib/i18n'
import { CountrySelect } from '@/components/ui/CountrySelect'
import type { FinanceStore } from '@/lib/store/types'

export interface ProfilePersonalDetailsSectionProps {
  store: FinanceStore
  user: User | null
}

/**
 * Name, email, phone, country, city fields.
 */
export function ProfilePersonalDetailsSection({ store, user }: ProfilePersonalDetailsSectionProps) {
  const t = useT()
  const { locale } = useLocale()
  const inputClass =
    'mt-1 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[var(--color-brand-red)]'

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        {t.profile.labelName}
      </h2>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.profile.labelName}</Label>
          <Input
            value={store.profile.name}
            onChange={(e) => store.updateProfile({ name: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {user ? t.profile.labelEmailAccount : t.profile.labelEmail}
          </Label>
          <Input
            value={store.profile.email || ''}
            onChange={(e) => {
              if (!user) store.updateProfile({ email: e.target.value })
            }}
            readOnly={!!user}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white read-only:opacity-80"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.profile.labelPhone}</Label>
          <Input
            value={store.profile.phone || ''}
            onChange={(e) => store.updateProfile({ phone: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.profile.labelCountry}</Label>
          <CountrySelect
            value={store.profile.country || ''}
            onChange={(nameEn) => store.updateProfile({ country: nameEn })}
            locale={locale}
            placeholder={t.profile.placeholderCountrySelect}
            className={inputClass}
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.profile.labelCity}</Label>
          <Input
            value={store.profile.city || ''}
            onChange={(e) => store.updateProfile({ city: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
      </div>
    </section>
  )
}
