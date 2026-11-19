import type { Page } from '@playwright/test'
import { expect, goto, test } from '../lib/fixtures'

// A fake microphone so holding the + can really start recording in headless Chromium.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

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
    await page.waitForTimeout(500)
    await holdFab(page)
    await expect(page.getByRole('dialog', { name: 'Add' })).toBeHidden()
    await expect(trash).toBeVisible()
    const t = (await trash.boundingBox())!
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(trash).toBeHidden()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
