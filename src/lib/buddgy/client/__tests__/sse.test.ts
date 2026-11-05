import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTurnEvents, STREAM_IDLE_MS, StreamIdleError } from '@/lib/buddgy/client/sse'

afterEach(() => vi.useRealTimers())

describe('readTurnEvents idle timeout', () => {
  it('fails a stream that stalls without closing', async () => {
    vi.useFakeTimers()
    const stalled = new Response(new ReadableStream<Uint8Array>({ start() {} }))
    const reading = readTurnEvents(stalled).next()
    const caught = reading.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(STREAM_IDLE_MS + 1)
    expect(await caught).toBeInstanceOf(StreamIdleError)
  })

  it('reads frames from a healthy stream', async () => {
    const body = new Response('data: {"t":"done","units":1,"finish":"stop","truncated":false}\n\n')
    const events = []
    for await (const ev of readTurnEvents(body)) events.push(ev)
    expect(events).toHaveLength(1)
  })
})
