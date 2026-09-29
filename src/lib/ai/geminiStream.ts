/** A Gemini content part; thought parts carry reasoning, not the answer. */
interface Part { text?: string; thought?: boolean }

function answerText(chunk: { candidates?: { content?: { parts?: Part[] } }[] }): string {
  return (chunk.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('')
}

/**
 * The `message` string of a JSON object that is still being written, decoded as
 * far as it goes — so the chat can show Buddgy's words while the rest of the JSON
 * (actions, mood) is still streaming. Null until the field has started.
 */
export function partialMessage(json: string): string | null {
  const start = json.match(/"message"\s*:\s*"/)
  if (!start || start.index === undefined) return null
  let i = start.index + start[0].length
  let raw = ''
  while (i < json.length) {
    const c = json[i]
    if (c === '"') break
    if (c === '\\') {
      const esc = json[i + 1]
      if (esc === undefined) break
      const len = esc === 'u' ? 6 : 2
      if (i + len > json.length) break // escape not fully arrived yet
      raw += json.slice(i, i + len)
      i += len
      continue
    }
    raw += c
    i++
  }
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw
  }
}

/**
 * Reads a proxy response into the model's answer text. With `onText`, the
 * response is an SSE stream and `onText` receives the partial `message` as it
 * grows; without it, a plain generateContent JSON body.
 */
export async function readGeminiText(response: Response, onText?: (message: string) => void): Promise<string> {
  if (!onText) return answerText(await response.json())
  // A fetch without body streams (some WebViews) still gets the SSE text, just at once.
  const stream = response.body ?? new Response(await response.text()).body!

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let shown = ''
  for (;;) {
    const { done, value } = await reader.read()
    buffer += done ? '\n' : decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        text += answerText(JSON.parse(line.slice(5)))
      } catch {
        // ponytail: a malformed SSE line is dropped; the final JSON parse surfaces real breakage.
      }
    }
    const msg = partialMessage(text)
    if (msg && msg !== shown) {
      shown = msg
      onText(msg)
    }
    if (done) break
  }
  return text
}
