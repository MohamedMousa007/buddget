import { defineConfig } from '@playwright/test'

/**
 * Round 3 API checks (BUD-94 in-app admin confirm, BUD-107 install_key), API mode (no browser) against the dev server on :3100 and the live project.
 * Creates and deletes its own synthetic users (qa-e2e-pr-r3-*), a staff row and a portal session on one of them.
 * Run: QA_ENV_FILE=<file with QA_PW> npx playwright test -c e2e/api/round3/playwright.config.ts --reporter=line --trace off
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
