import { describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ createClient }))
vi.mock('@/lib/supabase/env', () => ({ isSupabaseConfigured: () => false }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))

describe('refreshAssetPrices without Supabase', () => {
  it('does nothing instead of throwing into the console', async () => {
    const { refreshAssetPrices } = await import('../useAssetPrices')
    await expect(refreshAssetPrices({ force: true })).resolves.toBeUndefined()
    expect(createClient).not.toHaveBeenCalled()
  })
})
