'use client'

import { useEffect, useState } from 'react'
import { Loader2, MailX } from 'lucide-react'
import { AppLink } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { AuthFrame } from './AuthFrame'

/** Landing page for the emailed invite link: turns the link's session into a signed-in account, then opens the portal. */
export function AcceptInvite() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const access = params.get('access_token')
    const refresh = params.get('refresh_token')
    window.history.replaceState(null, '', window.location.pathname)
    if (!access || !refresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the link carried no session
      setFailed(true)
      return
    }
    void createClient()
      .auth.setSession({ access_token: access, refresh_token: refresh })
      .then(({ error }) => {
        if (error) setFailed(true)
        else window.location.replace('/admin')
      })
  }, [])

  if (!failed) {
    return (
      <AuthFrame title="Opening the portal" subtitle="Signing you in…">
        <div className="flex justify-center"><Loader2 className="size-6 animate-spin text-[var(--color-brand-primary)]" role="status" aria-label="Signing in" /></div>
      </AuthFrame>
    )
  }
  return (
    <AuthFrame title="This link has expired" subtitle="Invite links work once and expire quickly. Ask whoever invited you to send a new one, or sign in to Buddget with your email and open the admin icon.">
      <div className="flex flex-col items-center gap-4">
        <MailX className="size-8 text-[var(--color-brand-text-muted)]" aria-hidden />
        <AppLink href="/admin"><Button variant="outline" size="touch">Go to sign in</Button></AppLink>
      </div>
    </AuthFrame>
  )
}
