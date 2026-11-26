import { existsSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, goto, test } from '../lib/fixtures'

// A fake microphone so holding the + can really start recording in headless Chromium. `test.use` replaces the config's
// launchOptions whole, so keep the browser path the config picks (QA_CHROME, else the cloud image's Chromium).
const chrome = process.env.QA_CHROME ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
test.use({ launchOptions: { ...(chrome ? { executablePath: chrome } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

async function holdFab(page: Page) {
  const box = (await page.getByRole('button', { name: 'Quick add' }).first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1200)
}

test('Q7 holding the + records instead of opening the menu; dropping on the trash cancels', async ({ page, user, context }) => {
  void user
  await context.grantPermissions(['microphone'])
  await goto(page, '/flow')
  // The trash target exists only while recording; it has no accessible name (it is the floating widget's drop zone).
  const trash = page.locator('div.w-14.h-14.rounded-full.border-2').first()

  await test.step('first hold only asks for the microphone, and never opens the menu', async () => {
    await holdFab(page)
    await page.mouse.up()
    await expect(page.getByRole('dialog', { name: 'Add' })).toBeHidden()
    await expect(trash).toBeHidden()
  })
  await test.step('next hold records; dropping on the trash cancels without any AI call', async () => {
    // The permission answer resolves asynchronously; under load the next hold can still land on the prompt, so hold again.
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(800)
      await holdFab(page)
      if (await trash.isVisible({ timeout: 3000 }).catch(() => false)) break
      await page.mouse.up()
    }
    await expect(page.getByRole('dialog', { name: 'Add' })).toBeHidden()
    await expect(trash).toBeVisible()
    const t = (await trash.boundingBox())!
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(trash).toBeHidden()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
