import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * S8g browser journeys for Pro, Rewards, Invite and Founders against the dev server on :3100. One worker, no retries; run in groups
 * of about 6 specs. Each test signs in its own fresh synthetic user.
 * Run: QA_ENV_FILE=<file with QA_PW> npx playwright test -c e2e/journeys/specs/round2/pro-rewards/playwright.config.ts --reporter=line --trace off
 */
const chrome = process.env.QA_CHROME ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './test-results',
  timeout: 420_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:3100', trace: 'off', screenshot: 'only-on-failure', bypassCSP: true, actionTimeout: 30_000, navigationTimeout: 90_000,
    locale: 'en-US', timezoneId: 'Africa/Cairo', launchOptions: chrome ? { executablePath: chrome } : {},
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, launchOptions: chrome ? { executablePath: chrome } : {} } },
    { name: 'desktop', grep: /@desktop/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: chrome ? { executablePath: chrome } : {} } },
  ],
})
