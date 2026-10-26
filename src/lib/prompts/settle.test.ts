import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { settledKeys, settlePrompt } from './settle'

describe('settlePrompt', () => {
  beforeEach(() => {
    useFinanceStore.getState().reset()
    useSettingsStore.getState().reset()
  })

  it('hides the prompt here and records it with the account settings', () => {
    settlePrompt('pm:5521')
    expect(useSettingsStore.getState().dismissedBanners).toContain('pm:5521')
    expect(settledKeys(useFinanceStore.getState().settings.promptState)).toEqual(['pm:5521'])
  })

  it('keeps the first time it was answered', () => {
    settlePrompt('late:a')
    const first = useFinanceStore.getState().settings.promptState?.['late:a']
    settlePrompt('late:a')
    expect(useFinanceStore.getState().settings.promptState?.['late:a']).toBe(first)
  })

  it('is forgotten when the account is reset, so a new account on this phone starts clean', () => {
    settlePrompt('pm:1')
    useFinanceStore.getState().reset()
    useSettingsStore.getState().reset()
    expect(useSettingsStore.getState().dismissedBanners).toEqual([])
    expect(settledKeys(useFinanceStore.getState().settings.promptState)).toEqual([])
  })
})
