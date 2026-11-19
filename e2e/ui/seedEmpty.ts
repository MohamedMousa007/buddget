// Creates one EMPTY synthetic user and saves its signed-in state to e2e/ui/.st2.json (for states.mjs).
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { createConfirmedUser, qaEmail } from '../journeys/lib/admin'
import { forceFlags, installApiShim } from '../journeys/lib/apiShim'
import { signIn } from '../journeys/lib/fixtures'
;(async () => {
  const email = qaEmail('ui'); await createConfirmedUser(email); writeFileSync('e2e/ui/.seed-email-empty', email)
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:3100', bypassCSP: true, timezoneId: 'Africa/Cairo', locale: 'en-US' })
  await installApiShim(ctx); await forceFlags(ctx, { onboarding_v1: false })
  const page = await ctx.newPage(); await signIn(page, email)
  await ctx.storageState({ path: 'e2e/ui/.st2.json' }); await b.close(); console.log('empty user ready')
})()
