'use client'

import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/lib/i18n'

export default function NotFound() {
  const t = useT().systemPages.notFound
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        variant="hero"
        title={t.title}
        description={t.body}
        action={<AppLink href="/flow"><Button size="touch">{t.back}</Button></AppLink>}
      />
    </div>
  )
}
