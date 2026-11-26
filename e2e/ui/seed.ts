/* eslint-disable @typescript-eslint/no-explicit-any -- test code */
// Seeds one synthetic user (qa-e2e-ui-*) with accounts, spending, income and a debt, then saves e2e/ui/.st1.json for the sweeps.
// Run: PW_CHROMIUM_EXECUTABLE=... npx tsx e2e/ui/seed.ts   (cleanup: npx tsx e2e/journeys/lib/cleanup.ts --mine)
import { chromium, expect } from '@playwright/test'
import { existsSync, writeFileSync } from 'node:fs'
import { createConfirmedUser, qaEmail } from '../journeys/lib/admin'
import { forceFlags, installApiShim } from '../journeys/lib/apiShim'
import { signIn } from '../journeys/lib/fixtures'
import { addAccount, addBorrow, addExpense, addMoneyIn } from '../journeys/lib/ui'
;(async () => {
  const email = qaEmail('ui'); await createConfirmedUser(email)
  writeFileSync('e2e/ui/.seed-email', email)
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_EXECUTABLE ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:3100', bypassCSP: true, timezoneId: 'Africa/Cairo', locale: 'en-US' })
  await installApiShim(ctx); await forceFlags(ctx, { onboarding_v1: false })
  await ctx.addInitScript(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)) })
  const page = await ctx.newPage(); page.setDefaultTimeout(30000)
  await signIn(page, email)
  const step = async (n: string, f: () => Promise<void>) => { try { await f(); console.log('ok', n) } catch (e) { console.log('FAIL', n, String(e).slice(0, 160)) } }
  await step('cash', () => addAccount(page, { kind: 'Cash', balance: 1500 }))
  await step('bank', () => addAccount(page, { kind: 'Bank', provider: /^CIB/, balance: 25000 }))
  await step('wallet', () => addAccount(page, { kind: 'Wallet', provider: /^Vodafone Cash/, balance: 800 }))
  await page.goto('/flow', { waitUntil: 'domcontentloaded' }); await expect(page.getByRole('button', { name: 'Quick add' })).toBeVisible()
  await step('income', () => addMoneyIn(page, { amount: 12000, name: 'Salary' }))
  for (const [a, d, c] of [[250, 'Groceries run', 'Food'], [90, 'Taxi', 'Transport'], [430, 'Electricity', 'Utilities']] as const)
    await step('exp ' + d, () => addExpense(page, { amount: a, description: d, category: c }))
  await step('debt', () => addBorrow(page, { person: 'Ahmed', what: 'Rent help', amount: 3000 }))
  await ctx.storageState({ path: 'e2e/ui/.st1.json' }); await b.close(); console.log('seeded', email)
})()
