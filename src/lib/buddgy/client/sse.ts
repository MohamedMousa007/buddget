import type { TurnEvent } from '@/lib/buddgy/protocol'

/** The server gives up on a silent model after 25 s; a stream quiet for longer than this is dead. */
export const STREAM_IDLE_MS = 30_000

export class StreamIdleError extends Error {}

function readWithin(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new StreamIdleError('stream_idle')), ms)
    reader.read().then(
      (r) => { clearTimeout(timer); resolve(r) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** Reads Buddgy's `data: {json}` frames from a fetch response, one event at a time. */
export async function* readTurnEvents(response: Response): AsyncGenerator<TurnEvent> {
  if (!response.body) {
    // Some WebViews expose no body stream; the whole reply arrives at once.
    for (const line of (await response.text()).split('\n')) {
      const ev = parseFrame(line)
      if (ev) yield ev
    }
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await readWithin(reader, STREAM_IDLE_MS)
    } catch (e) {
      if (e instanceof StreamIdleError) reader.cancel().catch(() => undefined)
      throw e
    }
    const { done, value } = chunk
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const ev = parseFrame(line)
      if (ev) yield ev
    }
  }
  const last = parseFrame(buffer)
  if (last) yield last
}

function parseFrame(line: string): TurnEvent | null {
  if (!line.startsWith('data:')) return null
  try {
    return JSON.parse(line.slice(5).trim()) as TurnEvent
  } catch {
    return null
  }
}
