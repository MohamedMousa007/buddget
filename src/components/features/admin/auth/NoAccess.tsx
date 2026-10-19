'use client'

import { ShieldOff } from 'lucide-react'
import { appOrigin } from '@/lib/apiBase'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { AuthFrame } from './AuthFrame'

/** On the admin domain "/" is the portal itself, so the way out is an absolute link to the app's origin. */
export function NoAccess({ signedIn }: { signedIn: boolean }) {
  const title = signedIn ? 'Staff only' : 'Sign in to continue'
  const subtitle = signedIn
    ? 'This area is for the Buddget team. If you should have access, ask the owner to add your email.'
    : 'Sign in to Buddget with your staff email, then come back here. The portal opens automatically.'
  return (
    <AuthFrame title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center gap-4">
        <ShieldOff className="size-8 text-[var(--color-brand-text-muted)]" aria-hidden />
        <AppLink href={`${appOrigin()}/`}><Button variant="outline" size="touch">{signedIn ? 'Back to Buddget' : 'Open Buddget'}</Button></AppLink>
      </div>
    </AuthFrame>
  )
}
