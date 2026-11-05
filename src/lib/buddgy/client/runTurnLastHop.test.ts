import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
import { apiFetchAuth } from '@/lib/apiBase'
import { runTurn } from '@/lib/buddgy/client/runTurn'

const frame = (e: unknown) => `data: ${JSON.stringify(e)}\n\n`
const callsRes = () => new Response(
  frame({ t: 'meta', chatId: null, newChat: true, rolled: false, soft: false, tier: 'fast' }) +
  frame({ t: 'calls', parts: [{ functionCall: { name: 'get_settings', args: {} } }], calls: [{ name: 'get_settings', args: {} }] }) +
  frame({ t: 'done', units: 0, finish: 'STOP', truncated: false }))

describe('hop limit', () => {
  it('fails the turn instead of returning a blank reply when the model keeps calling reads', async () => {
    vi.mocked(apiFetchAuth).mockImplementation(async () => callsRes())
    await expect(runTurn({ text: 'hi', history: [], chatId: null, locale: 'en', intent: 'answer', route: '/', onText: () => {} })).rejects.toBeTruthy()
    expect(vi.mocked(apiFetchAuth)).toHaveBeenCalledTimes(4)
  })
})
