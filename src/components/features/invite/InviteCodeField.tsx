'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { clearRememberedInvite, normalizeInviteCode, readRememberedInvite, rememberInvite } from './inviteCode'

/**
 * "Have an invite code?" on the sign-up screen. A valid code is remembered on the device and redeemed once the account exists
 * (`BillingHost`); a code that arrived through an invite link is shown already filled in.
 */
export function InviteCodeField() {
  const c = useRewardsCopy().signup
  // Read once on mount: a code that arrived through an invite link is shown already filled in.
  const [value, setValue] = useState(() => (typeof window === 'undefined' ? '' : readRememberedInvite() ?? ''))
  const [open, setOpen] = useState(() => value !== '')

  const valid = normalizeInviteCode(value)
  const change = (raw: string) => {
    const next = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 21)
    setValue(next)
    const code = normalizeInviteCode(next)
    if (code) rememberInvite(code)
    else clearRememberedInvite()
  }

  if (!open) {
    return <Button variant="link" size="touch" onClick={() => setOpen(true)} className="mx-auto flex text-xs text-[var(--color-brand-text-secondary)]">{c.haveCode}</Button>
  }
  return (
    <div className="space-y-1">
      <label htmlFor="invite-code" dir="auto" className="block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.label}</label>
      <Input id="invite-code" size="brand" dir="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={value} placeholder={c.placeholder} onChange={(e) => change(e.target.value)} className="font-mono-numbers tracking-wider" />
      <p role="status" dir="auto" className="text-xs text-[var(--color-brand-text-muted)]">{valid ? c.saved : value.length >= 5 ? c.invalid : c.hint}</p>
    </div>
  )
}
