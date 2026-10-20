'use client'

import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { BuddgetMark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { appHostFor, configuredAdminHost, normalizeHost } from '@/lib/admin/host'
import { createClient } from '@/lib/supabase/client'

/** Where "Not you?" sends people: the app's own sign-in, on the app host when we are on the admin host. */
async function switchAccount() {
  await createClient().auth.signOut().catch(() => undefined)
  const onAdminHost = normalizeHost(window.location.hostname) === configuredAdminHost()
  window.location.assign(onAdminHost ? `https://${appHostFor(configuredAdminHost())}` : '/')
}

/** Which account the portal is acting for, with a way out when it is the wrong one. */
function SignedInAs({ email }: { email: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2 text-xs">
      <UserRound className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[var(--color-brand-text-secondary)]">
        Signed in as <strong className="font-semibold text-[var(--color-brand-text-primary)]">{email}</strong>
      </span>
      <Button variant="ghost" size="xs" onClick={() => void switchAccount()}>Not you?</Button>
    </div>
  )
}

/** Centered card used by every pre-portal screen (no access, setup, unlock). */
export function AuthFrame({ title, subtitle, children, wide = false, account }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean; account?: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] safe-area-bottom">
      <div className={wide ? 'w-full max-w-lg' : 'w-full max-w-sm'}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--color-brand-primary-soft)]">
            <BuddgetMark size={30} />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary-ink)]">Buddget Admin</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-[var(--color-brand-text-primary)]">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-[var(--color-brand-text-secondary)]">{subtitle}</p> : null}
        </div>
        {account ? <SignedInAs email={account} /> : null}
        <Card elevation="md" padding="lg">{children}</Card>
      </div>
    </div>
  )
}
