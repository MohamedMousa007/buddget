import path from 'path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// QA Session 04 live sync repros. Opt-in only: hits the testing Supabase project with synthetic users.
// Run: QA_SYNC_PW=... npx vitest run --config e2e/sync/vitest.config.ts
process.env.TZ ??= 'Africa/Cairo'
// Supabase URL and publishable key come from the repo's .env.local (never hardcoded).
Object.assign(process.env, loadEnv('', path.resolve(__dirname, '../..'), 'NEXT_PUBLIC_SUPABASE_'))

export default defineConfig({
  test: { testTimeout: 60_000, environment: 'node', include: ['e2e/sync/**/*.live.test.ts'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      'server-only': path.resolve(__dirname, '../../vitest.server-only-stub.ts'),
    },
  },
})
