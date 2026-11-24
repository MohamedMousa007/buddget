import { defineConfig } from '@playwright/test'

/**
 * Support conversation loop (migration 0346), API mode (no browser) against the dev server on :3100 and the live project.
 * Creates and deletes its own synthetic users (qa-e2e-pr-sup-*), a staff row and a portal session on one of them.
 * Run: QA_ENV_FILE=<file with QA_PW> npx playwright test -c e2e/api/round2/support/playwright.config.ts --reporter=line --trace off
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
