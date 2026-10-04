import { expect, test } from '@playwright/test';
import type { Aquarium } from '../../src/simulation';
declare global { interface Window { __aquarium: { sim: Aquarium; ready: boolean; workerMs: number; paused: boolean } } }

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__aquarium?.ready);
});
test('starts live, changes counts and presets, pauses, and opens credits', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('#brain-status')).toContainText('512 neurons');
  await expect(page.locator('#metric-fish')).toHaveText('24');
  await page.locator('[data-preset=".9"]').click(); await expect(page.locator('#metric-brain')).toHaveText('90%');
  await page.locator('[data-preset="0"]').click(); await expect(page.locator('#metric-brain')).toHaveText('0%');
  await page.locator('#fishCount').evaluate((input: HTMLInputElement) => { input.value = '30'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#metric-fish')).toHaveText('30');
  expect(await page.evaluate(() => window.__aquarium.sim.fish.length)).toBe(30);
  await page.locator('#pause').click(); await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  const before = await page.evaluate(() => window.__aquarium.sim.time); await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__aquarium.sim.time)).toBe(before);
  await page.locator('#pause').click(); await page.locator('#settings-reset').click();
  await expect(page.locator('#metric-brain')).toHaveText('70%');
  await page.locator('#credits-open').click(); await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('dialog')).toContainText('CC BY-NC 4.0');
  await page.locator('#about-close').click(); await expect(page.locator('dialog')).not.toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('aquarium.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('clicks use sensory stimuli, nearby fish react, and empty clicks feed from the surface', async ({ page }) => {
  await page.locator('#pause').click();
  await page.evaluate(() => {
    const sim = window.__aquarium.sim;
    sim.fish.forEach(f => Object.assign(f, { x: 800, y: 200 }));
    Object.assign(sim.fish[0], { x: 300, y: 300, angle: 0 });
    Object.assign(sim.fish[1], { x: 335, y: 310 }); sim.food = [];
  });
  const canvas = page.locator('#tank canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 300 / 1200, y: box.height * 300 / 720 } });
  const state = await page.evaluate(() => ({ food: window.__aquarium.sim.food.length, direct: window.__aquarium.sim.fish[0].startleLeft + window.__aquarium.sim.fish[0].startleRight, neighbour: window.__aquarium.sim.fish[1].startleLeft + window.__aquarium.sim.fish[1].startleRight }));
  expect(state.food).toBe(0); expect(state.direct).toBeGreaterThan(0); expect(state.neighbour).toBeGreaterThan(0);
  await canvas.click({ position: { x: box.width * 1000 / 1200, y: box.height * 400 / 720 } });
  expect(await page.evaluate(() => window.__aquarium.sim.food.every(f => f.y < 64))).toBe(true);
  expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBe(5);
  await page.locator('#inspect-mode').click();
  await canvas.click({ position: { x: box.width * 300 / 1200, y: box.height * 300 / 720 } });
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('#inspector')).toContainText('BRAIN ACTIVITY');
  await page.locator('#inspector-close').click(); await expect(page.locator('#inspector')).not.toBeVisible();
});
test('pure brain and maximum settings remain stable; quality updates the Worker', async ({ page }) => {
  await page.locator('summary').click();
  await page.locator('#quality').selectOption('high'); await expect(page.locator('#brain-status')).toContainText('768 neurons');
  for (const [id, value] of [['fishCount', '40'], ['predators', '8'], ['stations', '6'], ['flyWeight', '100']]) {
    await page.locator(`#${id}`).evaluate((input: HTMLInputElement, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => {
    const sim = window.__aquarium.sim;
    return { fish: sim.fish.length, finite: sim.fish.every(f => Number.isFinite(f.x + f.y + f.angle)), weight: sim.settings.flyWeight, spikes: sim.fish.reduce((sum, f) => sum + f.spikes, 0) };
  });
  expect(state.fish).toBe(40); expect(state.finite).toBe(true); expect(state.weight).toBe(1); expect(state.spikes).toBeGreaterThan(0);
  await page.locator('#quality').selectOption('low'); await expect(page.locator('#brain-status')).toContainText('256 neurons');
});
test('blocked connectome gives an explicit program fallback', async ({ page }) => {
  await page.route('**/data/connectome.json', route => route.abort());
  await page.reload();
  await expect(page.locator('#brain-status')).toContainText('Program');
  await expect(page.locator('#metric-brain')).toHaveText('0%');
  await page.locator('[data-preset=".9"]').click(); await expect(page.locator('#metric-brain')).toHaveText('0%');
});
