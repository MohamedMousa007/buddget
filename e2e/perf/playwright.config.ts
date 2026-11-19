import { defineConfig, devices } from '@playwright/test'

/** S8d performance harness against a PRODUCTION build served on :3100 (never `next dev`). Serial, one worker, no retries. */
export default defineConfig({
  testDir: './specs',
  outputDir: './out/pw',
  timeout: 900_000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    bypassCSP: true,
    locale: 'en-US',
    timezoneId: 'Africa/Cairo',
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
  },
  projects: [{ name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } }],
})
