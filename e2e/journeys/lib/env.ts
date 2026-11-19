import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Reads `.env.local` once (never logs values). */
let cache: Record<string, string> | null = null
export function env(name: string): string {
  if (!cache) {
    cache = {}
    const text = readFileSync(resolve(__dirname, '../../../.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) cache[m[1]] = m[2].trim()
    }
  }
  const v = process.env[name] ?? cache[name]
  if (!v) throw new Error(`missing env ${name}`)
  return v
}
