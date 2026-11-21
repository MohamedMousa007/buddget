import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: h.user }) }))

import { PrivacyRows } from './PrivacyRows'

describe('the Privacy & data rows of the settings hub', () => {
  beforeEach(() => { h.user = { id: 'u1' } })

  it('a signed-in user gets Privacy & lock with its subtitle, next to the security and data rows with theirs', () => {
    const html = renderToStaticMarkup(<PrivacyRows />)
    expect(html).toContain('href="/settings/privacy"')
    expect(html).toContain('Privacy &amp; lock')
    expect(html).toContain('Face ID, app lock, hidden balances')
    expect(html).toContain('href="/settings/security"')
    expect(html).toContain('Password, two-step, devices')
    expect(html).toContain('href="/settings/data"')
    expect(html).toContain('Export, restore, not counted')
  })

  it('a signed-out user keeps Data & backup and sees neither account screen', () => {
    h.user = null
    const html = renderToStaticMarkup(<PrivacyRows />)
    expect(html).toContain('href="/settings/data"')
    expect(html).not.toContain('href="/settings/privacy"')
    expect(html).not.toContain('href="/settings/security"')
  })
})
