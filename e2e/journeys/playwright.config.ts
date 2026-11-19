import { defineConfig, devices } from '@playwright/test'

/**
 * QA Session 05 journeys against the SHARED dev server on :3100 (never started or stopped here).
 * Run: npx playwright test -c e2e/journeys/playwright.config.ts
 * Mobile project runs every journey; the desktop project runs the @desktop-tagged navigation/persistence checks.
 */
export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: Number(process.env.QA_WORKERS ?? 2),
  retries: Number(process.env.QA_RETRIES ?? 1),
  reporter: [['list'], ['json', { outputFile: './test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    bypassCSP: true,
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    locale: 'en-US',
    timezoneId: 'Africa/Cairo',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true } },
    { name: 'desktop', grep: /@desktop/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
})
