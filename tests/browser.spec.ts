import { expect, test } from '@playwright/test'

const base = process.env.MERIDIAN_TEST_URL || 'http://localhost:3000'

test('signup explains required email confirmation without contacting auth', async ({ page }) => {
  await page.route('**/api/auth/signup', route => route.fulfill({ status: 201, json: { confirmed: false } }))
  await page.goto(base)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill('testplayer')
  await dialog.getByLabel('Email').fill('player@example.com')
  await dialog.getByLabel('Password').fill('test-only-password')
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Check your email')
})

for (const width of [390, 820, 1440]) {
  test(`layout and gameplay at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto(base)
    await expect(page.locator('style[data-meridian="shell"]')).toBeAttached()
    await expect(page.locator('.mr-nav')).toHaveCSS('display', 'grid')
    await expect(page.locator('.mr-dailygrid')).toHaveCSS('display', 'grid')
    await expect(page.locator('.mr-card').first()).toHaveCSS('display', 'flex')
    const logo = page.locator('.mr-logo img')
    await expect(logo).toBeVisible()
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/home-${width}.png` })
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('.mr-layer')).toHaveCSS('position', 'fixed')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.locator('#casual .mr-card').first().click()
    await page.getByRole('button', { name: 'Start Choice', exact: true }).click()
    await expect(page.locator('style[data-meridian="gameplay"]')).toBeAttached()
    await expect(page.locator('.gp-card')).toHaveCSS('display', 'flex')
    await expect(page.locator('.gp-options')).toHaveCSS('display', 'grid')
    await expect(page.locator('.gp-flag')).toBeVisible()
    await expect.poll(() => page.locator('.gp-flag').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await page.locator('.gp-options button').first().click()
    await expect(page.locator('.gp-feedback')).toBeVisible()
    await page.screenshot({ path: `test-results/game-${width}.png` })
    expect(errors).toEqual([])
  })
}
