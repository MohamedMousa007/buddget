import { describe, it, expect } from 'vitest'
import { settingsToRow } from '@/lib/supabase/remote/mappers/settingsMapper'
import { defaultServerSettings } from '@/lib/supabase/remote/sync'

describe('settingsToRow', () => {
  it('never sends two_factor_email_enabled: only /api/auth/two-factor changes it', () => {
    const row = settingsToRow({ ...defaultServerSettings('EGP', null), twoFactorEmailEnabled: true }, 'u')
    expect(row).not.toHaveProperty('two_factor_email_enabled')
  })
})
