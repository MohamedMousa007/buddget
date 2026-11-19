import { defineConfig } from '@playwright/test'

/**
 * S8c QA round 2: API, database and security regression specs (API mode, no browser) against the SHARED dev server on :3100.
 * Writes only to synthetic users qa-api-1..3 on the live project; run setup.mjs first and teardown.mjs after.
 * Run: QA_PW_FILE=<path> npx playwright test -c e2e/api/round2/playwright.config.ts --reporter=line --trace off
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './test-results',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: { baseURL: process.env.QA_BASE ?? 'http://localhost:3100', trace: 'off' },
})
