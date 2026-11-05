import { describe, expect, it, vi } from 'vitest'
import { applyBackupImport } from './applyBackupImport'

const copy = { error: 'bad', success: 'ok' }
const deps = (confirmed = true) => ({ confirm: vi.fn(async () => confirmed), importData: vi.fn(async () => {}), copy })

describe('applyBackupImport (HKS5)', () => {
  it('an empty or blank file is an error banner and never asks or replaces anything', async () => {
    for (const text of ['', '   \n', null, undefined]) {
      const d = deps()
      expect(await applyBackupImport(text, d)).toEqual({ variant: 'error', text: 'bad' })
      expect(d.confirm).not.toHaveBeenCalled()
      expect(d.importData).not.toHaveBeenCalled()
    }
  })

  it('declining the confirmation leaves local data untouched', async () => {
    const d = deps(false)
    expect(await applyBackupImport('{"a":1}', d)).toBeNull()
    expect(d.importData).not.toHaveBeenCalled()
  })

  it('confirming replaces the data and reports success', async () => {
    const d = deps()
    expect(await applyBackupImport('{"a":1}', d)).toEqual({ variant: 'success', text: 'ok' })
    expect(d.importData).toHaveBeenCalledWith('{"a":1}')
  })

  it('an import that throws shows its message, or the generic error', async () => {
    const d = deps()
    d.importData.mockRejectedValueOnce(new Error('Not a Buddget backup'))
    expect(await applyBackupImport('x', d)).toEqual({ variant: 'error', text: 'Not a Buddget backup' })
    d.importData.mockRejectedValueOnce('boom')
    expect(await applyBackupImport('x', d)).toEqual({ variant: 'error', text: 'bad' })
  })
})
