import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const locale = { current: 'en' as 'en' | 'ar' }
vi.mock('@/lib/i18n', () => ({ useLocale: () => ({ locale: locale.current, dir: 'ltr', setLocale: () => undefined }) }))
vi.mock('next/font/google', () => ({
  Pinyon_Script: () => ({ variable: 'font-signature-var', className: '' }),
  Aref_Ruqaa: () => ({ variable: 'font-signature-ar-var', className: '' }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/referrals/referralsApi', () => ({ fetchInviterFirstName: vi.fn(async () => 'Mohamed') }))

import { rewardsCopy } from '@/lib/i18n/rewardsCopy'
import { InviteLanding } from './InviteLanding'
import { INVITE_COOKIE, readRememberedInvite, saveInviteFromLink } from './inviteCode'

const NO_EXPIRY = /expir|valid until|ends on|ينتهي|صالح حتى/i

describe('the /i/<code> landing page (BDG-005)', () => {
  beforeEach(() => { locale.current = 'en' })

  it('renders the guest pass, the tap hint, the benefits and both ways in', () => {
    const out = renderToStaticMarkup(createElement(InviteLanding, { code: 'MOHAME-7K2' }))
    expect(out).toContain('aria-label="Your guest pass. Tap to flip"')
    expect(out).toContain('GUEST PASS')
    expect(out).toContain('37 Days of Pro')
    expect(out).toContain('MOHAME-7K2')
    expect(out).toContain('buddget.app/i/MOHAME-7K2')
    expect(out).toContain('Tap the pass to see what you get')
    expect(out).toContain('About 10x the AI, and the Advisor')
    expect(out).toContain('Create your account')
    expect(out).toContain('I already have buddget')
  })

  it('shows no expiry anywhere, in either language', () => {
    expect(renderToStaticMarkup(createElement(InviteLanding, { code: 'MOHAME-7K2' }))).not.toMatch(NO_EXPIRY)
    locale.current = 'ar'
    expect(renderToStaticMarkup(createElement(InviteLanding, { code: 'MOHAME-7K2' }))).not.toMatch(NO_EXPIRY)
    for (const c of [rewardsCopy.en.landing, rewardsCopy.ar.landing]) expect(JSON.stringify(c)).not.toMatch(NO_EXPIRY)
  })

  it('the pass is unsigned until the inviter name arrives (never a guessed name)', () => {
    const out = renderToStaticMarkup(createElement(InviteLanding, { code: 'MOHAME-7K2' }))
    expect(out).not.toContain('data-side')
    expect(out).toContain('You’ve got a guest pass')
  })

})

describe('the code is kept for sign-up, as the old link route did', () => {
  it('writes the 30-day Lax cookie and storage, Secure on https', () => {
    const writes: string[] = []
    const store = new Map<string, string>()
    vi.stubGlobal('window', { location: { protocol: 'https:' }, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } })
    vi.stubGlobal('document', { get cookie() { return writes.at(-1)?.split(';')[0] ?? '' }, set cookie(v: string) { writes.push(v) } })
    saveInviteFromLink('MOHAME-7K2')
    expect(writes).toEqual([`${INVITE_COOKIE}=MOHAME-7K2; Max-Age=2592000; Path=/; SameSite=Lax; Secure`])
    expect(readRememberedInvite()).toBe('MOHAME-7K2')
    store.clear()
    expect(readRememberedInvite()).toBe('MOHAME-7K2')
    vi.unstubAllGlobals()
  })
})
