import { expect, test, type Page } from '@playwright/test';
import type { AudioSnapshot } from '../../src/audio';
import type { Aquarium } from '../../src/simulation';
import { FISH_PROFILES, FISH_SPECIES, PREDATOR_KINDS } from '../../src/species';
import type { AquariumGame } from '../../src/game';
declare global { interface Window { __aquarium: { sim: Aquarium; game: AquariumGame; demonstrating: boolean; audio: AudioSnapshot; width: number; height: number; ready: boolean; workerMs: number; paused: boolean; brainFailed: boolean } } }
const pageErrors = new WeakMap<Page, string[]>();

test('notebook names and gentle friendship persist, and friends can be called', async ({ page }, testInfo) => {
  await page.locator('#pause').click();
  await page.evaluate(() => { const g = window.__aquarium.game; g.state.friends[1] = { name: '', bond: 8, rewarded: 1 }; g.name(1, ''); });
  await page.locator('#play-open').click(); await page.locator('#gentle-mode').check();
  await page.locator('#friend-fish').selectOption('1'); await page.locator('#friend-name').fill('ぽろん');
  await page.locator('#friend-name-form button').click(); await expect(page.locator('#friend-caption')).toContainText('ぽろん');
  await page.locator('#play-close').click(); await page.locator('#tank canvas').press('ArrowRight'); await page.locator('#tank canvas').press('Enter');
  expect(await page.evaluate(() => window.__aquarium.game.friend(1).bond)).toBe(10);
  expect(await page.evaluate(() => Math.max(window.__aquarium.sim.fish[0].startleLeft, window.__aquarium.sim.fish[0].startleRight))).toBeLessThan(.1);
  await page.locator('#play-open').click(); await page.locator('#friend-call').click();
  expect(await page.evaluate(() => window.__aquarium.game.call)).not.toBeNull();
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await page.locator('#play-open').click(); await expect(page.locator('#friend-caption')).toContainText('ぽろん'); await expect(page.locator('#gentle-mode')).toBeChecked();
  expect(await page.evaluate(() => window.__aquarium.game.friend(1).bond)).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: testInfo.outputPath('game-friendship.png') });
});

test('a musical phrase demos, guides notes and rewards a complete keyboard performance', async ({ page }, testInfo) => {
  await page.locator('#pause').click(); await page.locator('#play-open').click(); await page.locator('[data-play-tab="music"]').click();
  await page.locator('[data-start-phrase="0"]').click(); await expect(page.locator('body')).toHaveClass('tank-view');
  await expect(page.locator('#music-hud')).toBeVisible(); await expect.poll(() => page.evaluate(() => window.__aquarium.demonstrating)).toBe(false);
  expect(await page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(3);
  await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight'); await page.locator('#tank canvas').press('Enter');
  await expect(page.locator('#music-instruction')).toContainText('(1/3)');
  await expect(page.locator('#inspector')).toBeHidden();
  // Informational HUD content must allow fish underneath to be tapped.
  const point = await page.evaluate(() => {
    const a = window.__aquarium, r = document.querySelector('canvas')!.getBoundingClientRect();
    const p = { x: 90 / r.width * a.width, y: 110 / r.height * a.height };
    for (const f of a.sim.fish) if (f.id !== 3 && Math.hypot(f.x - p.x, f.y - p.y) < 55) { f.x = a.width * .8; f.y = a.height * .5 + f.id * 4; }
    Object.assign(a.sim.fish.find(f => f.id === 3)!, p);
    return { x: r.left + 90, y: r.top + 110 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.locator('#music-instruction')).toContainText('(2/3)');
  await page.screenshot({ path: testInfo.outputPath('game-melody.png') });
  await page.locator('#tank canvas').press('ArrowRight'); await page.locator('#tank canvas').press('ArrowRight'); await page.locator('#tank canvas').press('Enter');
  await expect(page.locator('#music-hud')).toBeHidden(); expect(await page.evaluate(() => window.__aquarium.game.state.songs)).toEqual([0]);
  expect(await page.evaluate(() => window.__aquarium.game.state.found)).toContain('song');
  await page.locator('#play-open').click(); await page.locator('[data-play-tab="music"]').click(); await expect(page.locator('#song-done-0')).toContainText('演奏できた');
});

test('shell purchases alter the tank, positions and ownership survive reset and reload', async ({ page }, testInfo) => {
  await page.locator('#pause').click(); await page.evaluate(() => { const g = window.__aquarium.game; g.state.shells = 100; g.name(1, ''); });
  await page.locator('#play-open').click(); await page.locator('[data-play-tab="decor"]').click();
  for (const id of ['night', 'pink', 'lavender', 'shell', 'arch', 'star']) await page.locator(`[data-buy="${id}"]`).click();
  await page.locator('select[data-prop="shell"]').selectOption('2'); await page.locator('input[data-prop="arch"]').uncheck();
  expect(await page.evaluate(() => window.__aquarium.game.state.theme)).toBe('night');
  expect(await page.evaluate(() => window.__aquarium.game.state.props.shell?.position)).toBe(2);
  await page.locator('#play-close').click(); await page.locator('#tank-open').click();
  await page.screenshot({ path: testInfo.outputPath('game-decorated-tank.png') });
  await page.locator('#tank-exit').click(); await page.locator('#reset').click();
  expect(await page.evaluate(() => window.__aquarium.game.state.owned.length)).toBe(6);
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  expect(await page.evaluate(() => [window.__aquarium.game.state.theme, window.__aquarium.game.state.plant, window.__aquarium.game.state.rock])).toEqual(['night', 'pink', 'lavender']);
  await page.locator('#play-open').click(); await page.locator('[data-play-tab="decor"]').click(); await page.locator('#decor-base').click();
  expect(await page.evaluate(() => window.__aquarium.game.state.theme)).toBe('sea'); expect(await page.evaluate(() => window.__aquarium.game.state.owned.length)).toBe(6);
});

test('observed behavior enters the journal and visiting creatures can be greeted', async ({ page }, testInfo) => {
  await page.locator('#pause').click(); await page.locator('#tank-open').click();
  await page.evaluate(() => {
    const { game, sim } = window.__aquarium;
    const fish = sim.fish.slice(0, 3); fish.forEach((f, i) => { f.x = 220 + i * 20; f.y = 170; f.angle = .1; f.speed = 30; f.fear = 0; });
    for (let i = 0; i < 6; i++) game.update(.5, fish, [{ x: 240, y: 170 }], 12);
    for (let i = 0; i < 42; i++) game.update(1, [], [], 12);
  });
  await expect(page.locator('#visitor-catch')).toContainText('おさんぽカニ');
  const crab = await page.evaluate(() => {
    const a = window.__aquarium, p = a.game.visitorPoint(a.width, a.height)!, r = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: r.left + p.x / a.width * r.width, y: r.top + p.y / a.height * r.height };
  });
  await page.mouse.click(crab.x, crab.y); expect(await page.evaluate(() => window.__aquarium.game.state.visits.crab)).toBe(1);
  await page.locator('#play-open').click(); await page.locator('[data-play-tab="journal"]').click();
  await expect(page.locator('[data-discovery="school"]')).toHaveClass(/found/); await expect(page.locator('[data-discovery="station"]')).toHaveClass(/found/);
  await page.screenshot({ path: testInfo.outputPath('game-journal.png') });
  await page.locator('#play-close').click(); await page.locator('#tank-exit').click();
  await page.evaluate(() => { const { game } = window.__aquarium; for (let i = 0; i < 150; i++) game.update(1, [], [], 20); });
  await expect(page.locator('#visitor-catch')).toContainText('夜のほたる魚');
  const point = await page.evaluate(() => window.__aquarium.game.visitorPoint(window.__aquarium.width, window.__aquarium.height)!);
  const box = (await page.locator('#tank canvas').boundingBox())!;
  const dimensions = await page.evaluate(() => [window.__aquarium.width, window.__aquarium.height]);
  await page.mouse.click(box.x + point.x / dimensions[0] * box.width, box.y + point.y / dimensions[1] * box.height);
  expect(await page.evaluate(() => window.__aquarium.game.state.visits.glow)).toBe(1); await expect(page.locator('#visitor-catch')).toBeHidden();
});

test('notebook handles corrupt storage and fits a narrow screen without leaving tank mode on dialog Escape', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('flyfish-play-v1', '{broken'));
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  expect(await page.evaluate(() => window.__aquarium.game.state.owned)).toEqual([]);
  await page.setViewportSize({ width: 320, height: 640 }); await page.locator('#tank-open').click(); await page.locator('#play-open').click();
  for (const tab of ['friends', 'music', 'journal', 'decor', 'visitors']) {
    await page.locator(`[data-play-tab="${tab}"]`).click();
    expect(await page.locator('#play-notebook').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(page.locator('#play-notebook')).not.toBeVisible(); await expect(page.locator('body')).toHaveClass('tank-view');
  await expect(page.locator('#tank canvas')).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.locator('body')).not.toHaveClass('tank-view');
});

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__aquarium?.ready);
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

for (const [track, root] of [['sunshine', 72], ['bubbles', 77], ['arcade', 74]] as const) {
  test(`${track} BGM schedules notes and fish pitches follow its key`, async ({ page }) => {
    expect(await page.evaluate(() => window.__aquarium.audio.contextState)).toBe('not-created');
    await page.locator('#sound-track').selectOption(track);
    await page.locator('#sound-toggle').click();
    await expect.poll(() => page.evaluate(() => window.__aquarium.audio.musicNotes)).toBeGreaterThan(0);
    await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight');
    await page.locator('#tank canvas').press('Enter');
    await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(1);
    const a = await page.evaluate(() => window.__aquarium.audio);
    expect(a.lastMidi).toBe(root); expect(a.lastDelay).toBeLessThanOrEqual(.076); expect(a.unlocked).toBe(true);
  });
}

test('three fish timbres work while paused and effects can be muted', async ({ page }, testInfo) => {
  await page.locator('#pause').click();
  await page.locator('#sound-toggle').click();
  await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight');
  expect(await page.evaluate(() => window.__aquarium.audio.playing)).toBe(false);
  for (const timbre of ['chip', 'pluck', 'sparkle']) {
    await page.locator('#sound-timbre').selectOption(timbre);
    const effects = await page.evaluate(() => window.__aquarium.audio.effectsPlayed);
    await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('Enter');
    await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(effects + 1);
  }
  await page.locator('[data-audio="effects"]').uncheck();
  const effects = await page.evaluate(() => window.__aquarium.audio.effectsPlayed);
  await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('Enter');
  await page.waitForTimeout(100); expect(await page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(effects);
  await page.screenshot({ path: testInfo.outputPath('sound-controls.png'), fullPage: true });
});

test('BGM, effects, volume and aquarium mute work independently', async ({ page }) => {
  await page.locator('#sound-toggle').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.unlocked)).toBe(true);
  await page.locator('[data-audio="bgm"]').uncheck();
  expect(await page.evaluate(() => window.__aquarium.audio.playing)).toBe(false);
  await page.locator('#feed-button').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBeGreaterThan(0);
  await page.locator('[data-audio="effects"]').uncheck();
  await page.locator('[data-audio="bgm"]').check();
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.playing)).toBe(true);
  await page.locator('#sound-volume').evaluate((input: HTMLInputElement) => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.level)).toBeLessThan(.0001);
  await page.locator('#sound-volume').evaluate((input: HTMLInputElement) => { input.value = '40'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const notes = await page.evaluate(() => window.__aquarium.audio.musicNotes);
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.musicNotes)).toBeGreaterThan(notes);
  await page.locator('#tank-open').click(); await page.locator('#tank-sound').click();
  await expect(page.locator('#tank-sound')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.contextState)).toBe('suspended');
  await page.locator('#tank-sound').click(); await expect(page.locator('#tank-sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tank-exit').click();
});

test('sound choices persist without autoplay and resume or reset on request', async ({ page }) => {
  await page.locator('#sound-track').selectOption('arcade'); await page.locator('#sound-timbre').selectOption('sparkle');
  await page.locator('[data-audio="sync"]').uncheck();
  await page.locator('#sound-volume').evaluate((input: HTMLInputElement) => { input.value = '55'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#sound-preview').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.unlocked)).toBe(true);
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await expect(page.locator('#sound-track')).toHaveValue('arcade'); await expect(page.locator('#sound-timbre')).toHaveValue('sparkle');
  await expect(page.locator('[data-audio="sync"]')).not.toBeChecked(); await expect(page.locator('#sound-volume')).toHaveValue('55');
  expect(await page.evaluate(() => window.__aquarium.audio.contextState)).toBe('not-created');
  await expect(page.locator('#sound-toggle')).toContainText('音をはじめる');
  await page.locator('#sound-toggle').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.playing)).toBe(true);
  await page.locator('#settings-reset').click(); await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('fish taps and rapid keyboard notes stay musical in aquarium mode', async ({ page }) => {
  await page.locator('#pause').click(); await page.locator('#tank-open').click();
  await page.locator('#tank-sound').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.unlocked)).toBe(true);
  await page.evaluate(() => {
    const a = window.__aquarium;
    a.sim.fish.forEach(f => { f.x = a.width * .8; f.y = a.height * .5; });
    Object.assign(a.sim.fish[0], { x: a.width * .3, y: a.height * .3 });
  });
  const canvas = page.locator('#tank canvas'), box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * .3, y: box.height * .3 } });
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(1);
  expect(await page.evaluate(() => window.__aquarium.audio.lastMidi)).toBe(72);
  await canvas.click({ position: { x: box.width * .65, y: box.height * .2 } });
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(2);
  await canvas.focus(); await canvas.press('ArrowRight');
  await page.evaluate(() => {
    const canvas = document.querySelector('#tank canvas')!;
    for (let i = 0; i < 2; i++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(4);
  await page.locator('#inspector-close').click();
  await page.locator('#tank-sound').click();
  await canvas.click({ position: { x: box.width * .3, y: box.height * .3 } });
  expect(await page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBe(4);
});

test('rapid sound toggles release old voices and resume music', async ({ page }) => {
  await page.locator('#pause').click(); await page.locator('#tank-open').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('#tank-sound').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.unlocked)).toBe(true);
    await page.locator('#tank-feed').click(); await page.locator('#tank-sound').click();
  }
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.contextState)).toBe('suspended');
  expect(await page.evaluate(() => window.__aquarium.audio.voices)).toBeLessThan(64);
  await page.locator('#tank-sound').click(); await page.locator('#tank-pause').click();
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.playing)).toBe(true);
});

test('unavailable audio keeps the aquarium usable and sound can be switched off', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
  });
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await page.locator('#sound-toggle').click(); await expect(page.locator('#sound-status')).toContainText('音を再生できません');
  expect(await page.evaluate(() => window.__aquarium.audio.unavailable)).toBe(true);
  await page.locator('#sound-toggle').click(); expect(await page.evaluate(() => window.__aquarium.audio.enabled)).toBe(false);
  await page.locator('#feed-button').click(); expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBeGreaterThanOrEqual(5);
});

async function expectFilledTank(page: Page) {
  await expect(page.locator('body')).toHaveClass('tank-view');
  await expect.poll(() => page.evaluate(() => {
    const a = window.__aquarium, r = document.querySelector('canvas')!.getBoundingClientRect();
    return Math.abs(r.x) < 1 && Math.abs(r.y) < 1 && Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1 && Math.abs(a.width / a.height - innerWidth / innerHeight) < .002;
  })).toBe(true);
  await expect(page.locator('.site-header')).not.toBeVisible();
  await expect(page.locator('#settings-panel')).not.toBeVisible();
  const controls = (await page.locator('#tank-controls').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(controls.x).toBeGreaterThanOrEqual(0); expect(controls.x + controls.width).toBeLessThanOrEqual(viewport.width);
  expect(controls.y + controls.height).toBeLessThanOrEqual(viewport.height);
}

test('screen-filling aquarium supports feeding, inspection and pause', async ({ page }, testInfo) => {
  await page.locator('#pause').click();
  const ids = await page.evaluate(() => window.__aquarium.sim.fish.map(f => f.id));
  await page.locator('#tank-open').click(); await expectFilledTank(page);
  await expect(page.locator('#tank-pause')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__aquarium.sim.fish.map(f => f.id))).toEqual(ids);
  await page.evaluate(() => { window.__aquarium.sim.food = []; });
  await page.locator('#tank-feed').click();
  expect(await page.evaluate(() => window.__aquarium.sim.food.length)).toBe(5);
  const canvas = page.locator('#tank canvas');
  await page.locator('#tank-inspect').click();
  await page.evaluate(() => {
    const a = window.__aquarium;
    a.sim.fish.forEach(f => { f.x = a.width * .8; f.y = a.height * .5; });
    Object.assign(a.sim.fish[0], { x: a.width * .35, y: a.height * .3 });
  });
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * .35, y: box.height * .3 } });
  await expect(page.locator('#inspector')).toBeVisible();
  expect(await page.evaluate(() => window.__aquarium.sim.selected)).toBe(ids[0]);
  await page.locator('#inspector-close').click(); await expect(canvas).toBeFocused();
  await page.locator('#tank-pause').click();
  const before = await page.evaluate(() => window.__aquarium.sim.time);
  await expect.poll(() => page.evaluate(() => window.__aquarium.sim.time)).toBeGreaterThan(before);
  await page.locator('#tank-pause').click(); await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('tank-mode.png') });
});

test('aquarium mode restores focus and dimensions through Escape and toolbar buttons', async ({ page }) => {
  await page.locator('#pause').click(); await page.locator('#tank-open').click();
  const canvas = page.locator('#tank canvas');
  await canvas.focus(); await canvas.press('Escape');
  await expect(page.locator('body')).not.toHaveClass('tank-view'); await expect(page.locator('#tank-open')).toBeFocused();
  expect(await page.evaluate(() => [window.__aquarium.width, window.__aquarium.height])).toEqual([1200, 720]);
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fullscreen').click(); await expectFilledTank(page);
  await page.locator('#tank-exit').click(); await expect(page.locator('#fullscreen')).toBeFocused();
});

test('aquarium mode adapts to rotation and opens directly without native fullscreen', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true }); });
  await page.goto('/?tank&debug'); await page.waitForFunction(() => window.__aquarium?.ready);
  await expectFilledTank(page); await expect(page.locator('#tank-browser-fullscreen')).not.toBeVisible();
  await page.locator('#tank-pause').click();
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }, { width: 412, height: 915 }]) {
    await page.setViewportSize(viewport); await expectFilledTank(page);
    const state = await page.evaluate(() => {
      const a = window.__aquarium;
      return a.sim.fish.every(f => Number.isFinite(f.x + f.y) && f.x > 28 && f.x < a.width - 28 && f.y > 44 && f.y < a.height - 71);
    });
    expect(state).toBe(true);
  }
  await page.locator('#tank-exit').click(); await expect(page.locator('#tank-open')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('all fish and enemy types can be switched, mixed, inspected and saved', async ({ page }, testInfo) => {
  await page.locator('#pause').click();
  const ids = await page.evaluate(() => window.__aquarium.sim.fish.map(f => f.id));
  for (const species of FISH_SPECIES) {
    await page.locator('#fishSpecies').selectOption(species);
    expect(await page.evaluate(() => [...new Set(window.__aquarium.sim.fish.map(f => f.species))])).toEqual([species]);
    await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight');
    await expect(page.locator('#inspector-fish-id')).toContainText(FISH_PROFILES[species].name);
  }
  expect(await page.evaluate(() => window.__aquarium.sim.fish.map(f => f.id))).toEqual(ids);
  for (const kind of PREDATOR_KINDS) {
    await page.locator('#predatorKind').selectOption(kind);
    expect(await page.evaluate(() => [...new Set(window.__aquarium.sim.predators.map(p => p.kind))])).toEqual([kind]);
  }
  await page.locator('#predator-mix').click(); await expect(page.locator('#predators-value')).toHaveText('3');
  expect(await page.evaluate(() => [...new Set(window.__aquarium.sim.predators.map(p => p.kind))])).toEqual([...PREDATOR_KINDS]);
  await page.reload(); await page.waitForFunction(() => window.__aquarium?.ready);
  await expect(page.locator('#fishSpecies')).toHaveValue('clownfish'); await expect(page.locator('#predatorKind')).toHaveValue('mixed');
  await expect(page.locator('#predators-value')).toHaveText('3');
  await page.locator('#fishSpecies').selectOption('mixed');
  expect(await page.evaluate(() => [...new Set(window.__aquarium.sim.fish.map(f => f.species))])).toHaveLength(5);
  await page.locator('#pause').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('species-aquarium.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await page.locator('#credits-open').click(); await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('#about')).toContainText('CC BY-NC 4.0');
  await page.locator('#about-close').click(); await expect(page.locator('#about')).not.toBeVisible();
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
