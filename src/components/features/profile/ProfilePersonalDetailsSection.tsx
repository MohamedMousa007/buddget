'use client'

import type { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FinanceStore } from '@/lib/store/types'

export interface ProfilePersonalDetailsSectionProps {
  store: FinanceStore
  user: User | null
}

/**
 * Name, email, phone, country, city fields.
 */
export function ProfilePersonalDetailsSection({ store, user }: ProfilePersonalDetailsSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
        Personal details
      </h2>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Name</Label>
          <Input
            value={store.profile.name}
            onChange={(e) => store.updateProfile({ name: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            Email {user ? '(from account)' : ''}
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
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Phone (optional)</Label>
          <Input
            value={store.profile.phone || ''}
            onChange={(e) => store.updateProfile({ phone: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Country</Label>
          <Input
            value={store.profile.country || ''}
            onChange={(e) => store.updateProfile({ country: e.target.value })}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">City</Label>
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
