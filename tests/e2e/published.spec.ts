import { expect, test } from '@playwright/test';

test('published aquarium loads its neural Worker and supports interaction', async ({ page, request }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?debug');
  await expect(page.locator('#brain-status')).toContainText('512 neurons', { timeout: 30_000 });
  await expect(page.locator('#metric-fish')).toHaveText('24');
  await page.waitForFunction(() => window.__aquarium?.sim.fish.some(f => f.spikes > 0));
  const data = await request.get('./data/connectome.json');
  expect(data.ok()).toBe(true); expect((await data.json()).neurons).toHaveLength(768);
  await page.locator('#pause').click();
  await page.locator('#predator-mix').click();
  await expect(page.locator('#predators-value')).toHaveText('3');
  expect(await page.evaluate(() => new Set(window.__aquarium.sim.fish.map(f => f.species)).size)).toBe(5);
  expect(await page.evaluate(() => new Set(window.__aquarium.sim.predators.map(p => p.kind)).size)).toBe(3);
  await page.locator('#fishSpecies').selectOption('puffer');
  expect(await page.evaluate(() => window.__aquarium.sim.fish.every(f => f.species === 'puffer'))).toBe(true);
  await page.locator('#fishSpecies').selectOption('mixed');
  await page.locator('#feed-button').click();
  expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBeGreaterThanOrEqual(5);
  await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight');
  await expect(page.locator('#inspector')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('published-aquarium.png'), fullPage: true });
  await page.locator('#tank-open').click();
  await expect(page.locator('body')).toHaveClass('tank-view');
  await expect.poll(() => page.evaluate(() => {
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1 && Math.abs(window.__aquarium.width / window.__aquarium.height - innerWidth / innerHeight) < .002;
  })).toBe(true);
  await page.locator('#tank-feed').click(); await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('published-tank-mode.png') });
  await page.locator('#tank-exit').click(); await expect(page.locator('#tank-open')).toBeVisible();
  expect(await page.evaluate(() => [window.__aquarium.width, window.__aquarium.height])).toEqual([1200, 720]);
  expect(errors).toEqual([]);
});
