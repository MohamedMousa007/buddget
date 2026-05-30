#!/usr/bin/env node
/**
 * Capacitor build wrapper.
 *
 * Static export (`output: 'export'`) refuses to compile route handlers that
 * use server APIs (`cookies()`, `headers()`, Supabase service client, etc).
 * The Capacitor shell never invokes those routes anyway — it talks to the
 * deployed origin via `NEXT_PUBLIC_API_BASE_URL`. So before running the
 * static export, we move `src/app/api` out of the way and `src/middleware.ts`
 * + `src/proxy.ts` aside, run the build, then restore them.
 *
 * Idempotent: a SIGINT or crashed build still leaves the original tree
 * intact thanks to the `restore()` finally-block.
 */

import { execSync } from 'node:child_process'
import { existsSync, renameSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  assertNativeEnv,
  loadEnvLocalIntoProcess,
  warnExtraEnvKeys,
} from './native-env.mjs'

// `fileURLToPath` correctly decodes URL escapes (spaces in the path, etc).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STASH_DIR = resolve(ROOT, '.cap-stash')

/**
 * Server-only files / dirs that must NOT be present during the static export.
 * Each entry is moved into `.cap-stash` and restored at the end of the run
 * (even on crash, via the `restore()` finally-block + signal handlers).
 *
 * Anything that uses `cookies()`, `headers()`, the Supabase service client,
 * or runs in middleware belongs here.
 */
const STASH_TARGETS = [
  { from: 'src/app/api', to: '.cap-stash/api' },
  { from: 'src/middleware.ts', to: '.cap-stash/middleware.ts' },
  { from: 'src/proxy.ts', to: '.cap-stash/proxy.ts' },
  { from: 'src/app/auth/callback', to: '.cap-stash/auth-callback' },
  { from: 'src/app/setup', to: '.cap-stash/setup' },
  { from: 'src/app/sitemap.ts', to: '.cap-stash/sitemap.ts' },
  { from: 'src/app/robots.ts', to: '.cap-stash/robots.ts' },
  { from: 'src/app/opengraph-image.tsx', to: '.cap-stash/opengraph-image.tsx' },
  // `force-dynamic` layouts that need SSR — the static export can't keep them.
  { from: 'src/app/onboarding/layout.tsx', to: '.cap-stash/onboarding-layout.tsx' },
  { from: 'src/app/install/layout.tsx', to: '.cap-stash/install-layout.tsx' },
  { from: 'src/app/reset-password/confirm/layout.tsx', to: '.cap-stash/reset-password-confirm-layout.tsx' },
]

function ensureStashDir() {
  if (!existsSync(STASH_DIR)) mkdirSync(STASH_DIR, { recursive: true })
}

function move(from, to) {
  const src = resolve(ROOT, from)
  const dest = resolve(ROOT, to)
  if (!existsSync(src)) return false
  renameSync(src, dest)
  return true
}

function stash() {
  ensureStashDir()
  for (const t of STASH_TARGETS) move(t.from, t.to)
}

function restore() {
  for (const t of STASH_TARGETS) {
    const stashed = resolve(ROOT, t.to)
    if (!existsSync(stashed)) continue
    const original = resolve(ROOT, t.from)
    renameSync(stashed, original)
  }
}

process.on('SIGINT', () => {
  restore()
  process.exit(130)
})
process.on('SIGTERM', () => {
  restore()
  process.exit(143)
})

loadEnvLocalIntoProcess()
warnExtraEnvKeys()
assertNativeEnv({ exitOnError: true })

try {
  console.log('[cap-build] stashing /api and /middleware')
  stash()

  const env = { ...process.env, CAPACITOR: 'true' }
  console.log('[cap-build] running next build (static export)…')
  execSync('next build --webpack', { stdio: 'inherit', env, cwd: ROOT })

  const hasAndroid = existsSync(resolve(ROOT, 'android'))
  const hasIos = existsSync(resolve(ROOT, 'ios'))
  if (hasAndroid || hasIos) {
    console.log('[cap-build] running npx cap sync…')
    execSync('npx cap sync', { stdio: 'inherit', env, cwd: ROOT })
  } else {
    console.log('[cap-build] no android/ or ios/ folder — skipping cap sync. Run `npx cap add android` or `npx cap add ios` first.')
  }
} catch (err) {
  console.error('[cap-build] failed:', err?.message ?? err)
  restore()
  process.exit(1)
} finally {
  restore()
  console.log('[cap-build] restored stashed paths')
}
