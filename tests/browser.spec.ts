import { expect, test } from '@playwright/test'

const base = process.env.MERIDIAN_TEST_URL || 'http://localhost:3000'

test('signup explains required email confirmation without contacting auth', async ({ page }) => {
  await page.route('**/api/auth/signup', route => route.fulfill({ status: 201, json: { confirmed: false } }))
  await page.goto(base)
  await page.getByRole('button', { name: 'create account', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('username').fill('testplayer')
  await dialog.getByLabel('email').fill('player@example.com')
  await dialog.getByLabel('password').fill('test-only-password')
  await dialog.getByRole('button', { name: 'create account', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('check your email')
})

test('design system: three type sizes, two inks, one button height', async ({ page }) => {
  await page.goto(base)
  const sizes = await page.evaluate(() => {
    const seen = new Set<string>()
    document.querySelectorAll<HTMLElement>('.mr-app h1, .mr-app h2, .mr-app p, .mr-app .btn, .mr-app .chip, .mr-app .kicker, .mr-app .mr-metric').forEach(node => seen.add(getComputedStyle(node).fontSize))
    return [...seen]
  })
  expect(sizes.length).toBeLessThanOrEqual(3)
  const colors = await page.evaluate(() => {
    const seen = new Set<string>()
    document.querySelectorAll<HTMLElement>('.mr-app h1, .mr-app h2, .mr-app p, .mr-app .kicker, .mr-app .mr-metric, .mr-app .btn.quiet').forEach(node => seen.add(getComputedStyle(node).color))
    return [...seen]
  })
  expect(colors.length).toBeLessThanOrEqual(2)
  const heights = await page.evaluate(() => [...new Set([...document.querySelectorAll<HTMLElement>('.mr-nav .btn')].map(node => node.getBoundingClientRect().height))])
  expect(heights.length).toBe(1)
  const transform = await page.locator('body').evaluate(node => getComputedStyle(node).textTransform)
  expect(transform).toBe('lowercase')
})

for (const width of [390, 820, 1440]) {
  test(`layout and gameplay at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto(base)
    await expect(page.locator('.mr-nav')).toHaveCSS('display', 'grid')
    await expect(page.locator('.mr-dailygrid')).toHaveCSS('display', 'grid')
    await expect(page.locator('.mr-card').first()).toHaveCSS('display', 'flex')
    await expect(page.locator('.mr-card svg')).toHaveCount(0)
    const logo = page.locator('.mr-logo img')
    await expect(logo).toBeVisible()
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    expect(await logo.evaluate(image => image.getBoundingClientRect().width)).toBeGreaterThanOrEqual(150)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/home-${width}.png` })
    await page.getByRole('button', { name: 'log in', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('.mr-layer')).toHaveCSS('position', 'fixed')
    await page.getByRole('button', { name: 'close', exact: true }).click()
    await page.locator('#casual .mr-card').first().click()
    await page.getByRole('button', { name: 'start choice', exact: true }).click()
    await expect(page.locator('.gp-shell')).toHaveCSS('position', 'fixed')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect(page.locator('.gp-card')).toHaveCSS('display', 'flex')
    await expect(page.locator('.gp-options')).toHaveCSS('display', 'grid')
    await expect(page.locator('.gp-flag')).toBeVisible()
    await expect.poll(() => page.locator('.gp-flag').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await page.locator('.gp-options button').first().click()
    await expect(page.locator('.gp-next')).toBeVisible()
    const picked = await page.locator('.gp-options button').first().getAttribute('class')
    expect(picked).toMatch(/yes|no/)
    const button = page.locator('.gp-next')
    const box = await button.boundingBox()
    const card = await page.locator('.gp-card').boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    expect(box!.x).toBeGreaterThanOrEqual(card!.x)
    await page.screenshot({ path: `test-results/game-${width}.png` })
    expect(errors).toEqual([])
  })
}
