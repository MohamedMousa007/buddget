'use client'

import { ShieldOff } from 'lucide-react'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { AuthFrame } from './AuthFrame'

export function NoAccess() {
  return (
    <AuthFrame title="Staff only" subtitle="This area is for the Buddget team. If you should have access, ask the owner to add your email.">
      <div className="flex flex-col items-center gap-4">
        <ShieldOff className="size-8 text-[var(--color-brand-text-muted)]" aria-hidden />
        <AppLink href="/"><Button variant="outline" size="touch">Back to Buddget</Button></AppLink>
      </div>
    </AuthFrame>
  )
}
