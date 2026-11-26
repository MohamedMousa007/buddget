import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Reads `.env.local` once when it exists (never logs values); process env wins, so a cloud runner with the vars set needs no file. */
let cache: Record<string, string> | null = null
export function env(name: string): string {
  if (process.env[name]) return process.env[name] as string
  if (!cache) {
    cache = {}
    const file = resolve(__dirname, '../../../.env.local')
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m) cache[m[1]] = m[2].trim()
      }
    }
  }
  const v = cache[name]
  if (!v) throw new Error(`missing env ${name}`)
  return v
}
