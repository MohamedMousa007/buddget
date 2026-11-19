import { defineConfig } from '@playwright/test'

/**
 * S8g QA round 2: Pro, Rewards, Invite and Founders (API mode, no browser) against the dev server on :3100 and the live project.
 * Each spec creates and deletes its own synthetic users (qa-e2e-pr-*). teardown.mjs sweeps anything left.
 * Run: QA_ENV_FILE=<file with QA_PW and the local test secrets> npx playwright test -c e2e/api/round2/pro-rewards/playwright.config.ts --reporter=line --trace off
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './test-results',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: { baseURL: process.env.QA_BASE ?? 'http://localhost:3100', trace: 'off' },
})
