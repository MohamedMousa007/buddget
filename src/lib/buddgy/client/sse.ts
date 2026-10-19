import type { TurnEvent } from '@/lib/buddgy/protocol'

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
    const { done, value } = await reader.read()
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
