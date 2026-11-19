import { test, signInUi, openLoaded } from './fixture'
import { setLoyalty } from '../../../../api/round2/pro-rewards/lib'
test('probe @probe', async ({ page, qa }) => {
  test.skip(!process.env.QA_PROBE)
  const u = await qa('probe')
  await setLoyalty(u.id, { tier_key: 'emerald', lifetime_points: 350, points_balance: 350, gifted_rank: 1 })
  await signInUi(page, u.email)
  for (const p of ['/settings', '/settings/pro', '/settings/pro/usage', '/settings/rewards', '/settings/invite', '/settings/founders']) {
    await openLoaded(page, p).catch(() => undefined)
    await page.waitForTimeout(2500)
    const d = await page.evaluate(() => ({ url: location.pathname, t: (document.querySelector('main') as HTMLElement)?.innerText.replace(/\s+/g,' ').slice(0, 700), h: [...document.querySelectorAll('main h1,main h2,main h3')].map((e) => (e as HTMLElement).innerText.trim()).slice(0, 15), b: [...document.querySelectorAll('main button,main a[href],main [role=button]')].map((e) => ((e.getAttribute('aria-label') || (e as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 50)).filter(Boolean).slice(0, 60) }))
    console.log(JSON.stringify(d))
  }
})
