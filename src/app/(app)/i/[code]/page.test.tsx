import { describe, expect, it, vi } from 'vitest'
import { isValidElement } from 'react'

// Lives beside the page: the native build stashes this folder, test included.
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`redirect:${to}`) }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/features/invite/InviteLanding', () => ({ InviteLanding: () => null }))

import InviteLinkPage from './page'

describe('/i/<code>', () => {
  it('renders the landing for a code, normalised, and opens the app for anything else', async () => {
    const el = await InviteLinkPage({ params: Promise.resolve({ code: 'mohame-7k2' }) })
    expect(isValidElement(el) && (el.props as { code: string }).code).toBe('MOHAME-7K2')
    for (const bad of ['!!', 'nocode', 'AB-123;x=1']) await expect(InviteLinkPage({ params: Promise.resolve({ code: bad }) })).rejects.toThrow('redirect:/')
  })
})
