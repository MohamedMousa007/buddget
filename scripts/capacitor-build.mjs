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
import { existsSync, renameSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs'
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
  // Integration tests import the API route handlers stashed above, so they can't type-check in this build.
  { from: 'src/lib/server/admin/__tests__', to: '.cap-stash/admin-tests' },
  { from: 'src/instrumentation.ts', to: '.cap-stash/instrumentation.ts' },
  { from: 'src/instrumentation-node.ts', to: '.cap-stash/instrumentation-node.ts' },
  { from: 'src/app/auth/callback', to: '.cap-stash/auth-callback' },
  // Catch-all that renders the branded 404: a dynamic route cannot be exported without generateStaticParams, and the export already emits 404.html.
  { from: 'src/app/(app)/[...slug]', to: '.cap-stash/app-catch-all' },
  { from: 'src/app/setup', to: '.cap-stash/setup' },
  { from: 'src/app/sitemap.ts', to: '.cap-stash/sitemap.ts' },
  // The marketing website is web-only: static pages with their own root layouts.
  { from: 'src/app/(site-en)', to: '.cap-stash/site-en' },
  { from: 'src/app/(site-ar)', to: '.cap-stash/site-ar' },
  { from: 'src/app/robots.ts', to: '.cap-stash/robots.ts' },
  // `force-dynamic` layouts that need SSR — the static export can't keep them.
  { from: 'src/app/(app)/onboarding/layout.tsx', to: '.cap-stash/onboarding-layout.tsx' },
  { from: 'src/app/(app)/install/layout.tsx', to: '.cap-stash/install-layout.tsx' },
  { from: 'src/app/(app)/reset-password/confirm/layout.tsx', to: '.cap-stash/reset-password-confirm-layout.tsx' },
]

/** Uploads the web bundle's source maps to Sentry, then deletes every .map so none ship inside the app. */
function uploadAndStripSourceMaps() {
  const out = resolve(ROOT, 'out')
  const version = /APP_CLIENT_VERSION = '([^']+)'/.exec(readFileSync(resolve(ROOT, 'src/lib/appVersion.ts'), 'utf8'))?.[1]
  try {
    execSync(`sentry-cli sourcemaps inject "${out}"`, { stdio: 'inherit', cwd: ROOT })
    execSync(`sentry-cli sourcemaps upload --release "buddget@${version}" "${out}"`, { stdio: 'inherit', cwd: ROOT })
  } catch (err) {
    console.warn(`[cap-build] WARNING: source map upload failed, web stacks in Sentry will be minified: ${err?.message ?? err}`)
  }
  const strip = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name)
      if (e.isDirectory()) strip(p)
      else if (e.name.endsWith('.map')) rmSync(p)
    }
  }
  strip(out)
}

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

  const env = { ...process.env, CAPACITOR: 'true', NEXT_PUBLIC_NATIVE_SHELL: 'true' }
  console.log('[cap-build] running next build (static export)…')
  execSync('next build --webpack', { stdio: 'inherit', env, cwd: ROOT })

  uploadAndStripSourceMaps()

  const hasAndroid = existsSync(resolve(ROOT, 'android'))
  const hasIos = existsSync(resolve(ROOT, 'ios'))
  if (hasAndroid || hasIos) {
    execSync('node scripts/patch-android-plugins.mjs', { stdio: 'inherit', cwd: ROOT })
    console.log('[cap-build] running npx cap sync…')
    execSync('npx cap sync', { stdio: 'inherit', env: { ...env, NODE_ENV: 'production' }, cwd: ROOT })
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
