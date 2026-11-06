import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface SettingsSectionProps {
  title?: string
  children: ReactNode
}

/** A small-caps caption over one divided card of rows. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section>
      {title ? (
        <p className="px-1 pb-1.5 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)]">{title}</p>
      ) : null}
      <Card padding="none" divide className="overflow-hidden">
        {children}
      </Card>
    </section>
  )
}
