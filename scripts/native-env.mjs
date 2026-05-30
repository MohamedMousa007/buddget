#!/usr/bin/env node
/**
 * Native (Capacitor) env — single local file: `.env.local`
 * Template: `.env.example` (copy once: `cp .env.example .env.local`)
 *
 * Server/API secrets live on Vercel only. Do not `vercel env pull` into `.env.local`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const ENV_LOCAL_PATH = resolve(ROOT, '.env.local')

/** Keys baked into the Capacitor static bundle — keep `.env.local` limited to this set. */
export const NATIVE_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_OAUTH_GOOGLE',
  'NEXT_PUBLIC_OAUTH_APPLE',
]

export function parseEnvFile(text) {
  const entries = new Map()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    entries.set(key, val)
  }
  return entries
}

export function loadEnvLocalIntoProcess() {
  if (!existsSync(ENV_LOCAL_PATH)) return false
  const entries = parseEnvFile(readFileSync(ENV_LOCAL_PATH, 'utf8'))
  for (const [key, val] of entries) {
    if (process.env[key] === undefined) process.env[key] = val
  }
  return true
}

export function normalizeNativeEnv() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (apiBase && !appUrl) process.env.NEXT_PUBLIC_APP_URL = apiBase
  if (appUrl && !apiBase) process.env.NEXT_PUBLIC_API_BASE_URL = appUrl
}

export function assertNativeEnv({ exitOnError = false } = {}) {
  normalizeNativeEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ''
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''

  const missing = []
  if (!url || url.includes('dummy.supabase.co')) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!publishable || publishable === 'dummy-anon-key') {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }
  if (!apiBase) missing.push('NEXT_PUBLIC_API_BASE_URL')

  if (missing.length > 0) {
    const msg = `[native-env] Missing in .env.local (see .env.example):\n${missing.map((k) => `  • ${k}`).join('\n')}\n`
    if (exitOnError) {
      console.error(msg)
      process.exit(1)
    }
    return { ok: false, missing }
  }
  return { ok: true, missing: [] }
}

export function warnExtraEnvKeys() {
  if (!existsSync(ENV_LOCAL_PATH)) return
  const entries = parseEnvFile(readFileSync(ENV_LOCAL_PATH, 'utf8'))
  const allowed = new Set(NATIVE_ENV_KEYS)
  const extra = [...entries.keys()].filter((k) => !allowed.has(k))
  if (extra.length === 0) return
  console.warn(
    `[native-env] .env.local has keys not used for native builds (safe to remove; server vars belong on Vercel):\n${extra.map((k) => `  • ${k}`).join('\n')}`,
  )
}

if (process.argv[1]?.endsWith('native-env.mjs')) {
  const cmd = process.argv[2] ?? 'check'
  if (cmd === 'check') {
    loadEnvLocalIntoProcess()
    warnExtraEnvKeys()
    const result = assertNativeEnv({ exitOnError: true })
    if (result.ok) console.log('[native-env] .env.local OK for Capacitor builds')
  } else {
    console.error('Usage: node scripts/native-env.mjs check')
    process.exit(1)
  }
}
