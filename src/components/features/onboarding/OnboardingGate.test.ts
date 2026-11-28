import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ navigate: vi.fn(), path: '/', user: { id: 'u' } as { id: string } | null, state: 'new', ready: true }))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), useEffect: (fn: () => void) => fn() }))
vi.mock('@/lib/navigation/navigate', () => ({ navigate: h.navigate }))
vi.mock('@/lib/navigation/navStore', () => ({ useNavPath: () => h.path }))
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock('./useOnboardingState', () => ({ useOnboardingState: () => ({ state: h.state, ready: h.ready }) }))

import { OnboardingGate } from './OnboardingGate'

let n = 0
const at = (path: string) => { h.path = path; OnboardingGate() }

beforeEach(() => { h.navigate.mockClear(); h.user = { id: `u${++n}` }; h.state = 'new'; h.ready = true })

describe('OnboardingGate', () => {
  it.each(['/', '/flow', '/settings/profile', '/wealth'])('sends a new account on %s to /start', (path) => {
    at(path)
    expect(h.navigate).toHaveBeenCalledWith('/start', { replace: true })
  })

  it('offers once: leaving /start does not bring it back', () => {
    at('/start')
    at('/accounts')
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('stays put when onboarding is hidden, not ready, or signed out', () => {
    h.state = 'hidden'; at('/settings/profile')
    h.state = 'new'; h.ready = false; at('/settings/profile')
    h.ready = true; h.user = null; at('/settings/profile')
    expect(h.navigate).not.toHaveBeenCalled()
  })
})
