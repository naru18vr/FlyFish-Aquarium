import { expect, test, type Page } from '@playwright/test';
import type { Aquarium } from '../../src/simulation';
declare global { interface Window { __aquarium: { sim: Aquarium; ready: boolean; workerMs: number; paused: boolean; brainFailed: boolean } } }
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__aquarium?.ready);
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });
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
  const closeHandle = await page.locator('#inspector-close').elementHandle();
  await page.waitForTimeout(450);
  expect(await closeHandle!.evaluate(element => element.isConnected)).toBe(true);
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

test('keyboard selection, stimulation, feeding and inspection are accessible', async ({ page }) => {
  await page.locator('#pause').click();
  const canvas = page.locator('#tank canvas');
  await canvas.focus(); await canvas.press('ArrowRight');
  await expect(page.locator('#inspector')).toBeVisible();
  const selected = await page.evaluate(() => window.__aquarium.sim.selected);
  await canvas.press('Enter');
  expect(await page.evaluate(id => { const f = window.__aquarium.sim.fish.find(f => f.id === id)!; return Math.max(f.startleLeft, f.startleRight); }, selected)).toBeGreaterThan(0);
  await canvas.press('ArrowRight');
  expect(await page.evaluate(() => window.__aquarium.sim.selected)).not.toBe(selected);
  await page.locator('#inspector-close').click(); await expect(canvas).toBeFocused();
  const foodBefore = await page.evaluate(() => window.__aquarium.sim.food.length);
  await canvas.press('Space');
  expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBe(foodBefore + 5);
  await page.locator('#inspect-mode').click(); await expect(page.locator('#inspect-mode')).toHaveAttribute('aria-pressed', 'true');
  await canvas.focus(); await canvas.press('Escape'); await expect(page.locator('#inspect-mode')).toHaveAttribute('aria-pressed', 'false');
});

test('right clicks do not feed and settings survive reload with bounded values', async ({ page }) => {
  await page.locator('#pause').click();
  const food = await page.evaluate(() => window.__aquarium.sim.food.length);
  await page.locator('#tank canvas').click({ button: 'right' });
  expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBe(food);
  await page.evaluate(() => localStorage.setItem('flyfish-settings-v1', JSON.stringify({ fishCount: 900, predators: -1, stations: 99, flyWeight: .25, quality: 'invalid', bubbles: false })));
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await expect(page.locator('#metric-fish')).toHaveText('40'); await expect(page.locator('#metric-brain')).toHaveText('25%');
  expect(await page.evaluate(() => window.__aquarium.sim.settings)).toMatchObject({ fishCount: 40, predators: 0, stations: 6, quality: 'medium', bubbles: false });
  await page.evaluate(() => localStorage.setItem('flyfish-settings-v1', 'null'));
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await expect(page.locator('#metric-fish')).toHaveText('24'); await expect(page.locator('#metric-brain')).toHaveText('70%');
});

test('rapid quality changes and reset keep the final neural configuration', async ({ page }) => {
  await page.locator('summary').click();
  await page.evaluate(() => {
    const quality = document.querySelector<HTMLSelectElement>('#quality')!;
    for (const value of ['high', 'low', 'high', 'medium']) { quality.value = value; quality.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector<HTMLButtonElement>('#reset')!.click();
  });
  await expect(page.locator('#brain-status')).toContainText('512 neurons');
  await page.waitForFunction(() => window.__aquarium.ready && window.__aquarium.sim.fish.some(f => f.spikes > 0));
  await expect(page.locator('#quality')).toHaveValue('medium');
  await expect(page.locator('#inspector')).not.toBeVisible();
});

test('unresponsive Worker recovers instead of waiting forever', async ({ page }) => {
  await page.route('**/assets/worker-*.js', route => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => {};' }));
  await page.reload();
  await expect(page.locator('#brain-status')).toContainText('Program', { timeout: 22_000 });
  await expect(page.locator('#metric-brain')).toHaveText('0%');
  expect(await page.evaluate(() => window.__aquarium.brainFailed)).toBe(true);
  const before = await page.evaluate(() => window.__aquarium.sim.time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__aquarium.sim.time)).toBeGreaterThan(before);
});

test('corrupt connection data cannot silently masquerade as a working brain', async ({ page }) => {
  await page.route('**/data/connectome.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ neurons: [{ id: '1', nt: 'ACH', adapterGroup: 9 }], edges: [[0, 0, 5]] }) }));
  await page.reload();
  await expect(page.locator('#brain-status')).toContainText('Program');
  await expect(page.locator('#metric-brain')).toHaveText('0%');
});

test('narrow and landscape screens keep controls inside the viewport', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#about-open').click(); await expect(page.locator('#about')).toBeVisible();
    const dialog = (await page.locator('#about').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width);
    await page.locator('#about-close').click();
  }
  await page.locator('#settings-toggle').click(); await expect(page.locator('#settings-panel')).not.toBeVisible();
  await page.locator('#settings-toggle').click(); await expect(page.locator('#settings-panel')).toBeVisible();
});
