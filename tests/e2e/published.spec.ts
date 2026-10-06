import { expect, test, type Page } from '@playwright/test';

declare global { interface Window { __audioCapture: { context: AudioContext; stream: MediaStream; recorder?: MediaRecorder; chunks: Blob[] } } }
async function startCapture(page: Page) {
  await page.evaluate(() => {
    const capture = window.__audioCapture;
    capture.chunks = []; capture.recorder = new MediaRecorder(capture.stream);
    capture.recorder.ondataavailable = event => capture.chunks.push(event.data);
    capture.recorder.start();
  });
}
async function capturedPeak(page: Page) {
  return page.evaluate(async () => {
    const capture = window.__audioCapture, recorder = capture.recorder!;
    await new Promise<void>(resolve => { recorder.onstop = () => resolve(); recorder.stop(); });
    const buffer = await capture.context.decodeAudioData(await new Blob(capture.chunks, { type: recorder.mimeType }).arrayBuffer());
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) for (const sample of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(sample));
    return peak;
  });
}

test('published notebook discovers fish and exchanges shells for a lasting decoration', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./?tank&debug'); await page.waitForFunction(() => window.__aquarium?.game.state.found.length >= 5);
  await page.locator('#play-open').click(); await expect(page.locator('#play-notebook')).toBeVisible();
  await page.locator('[data-play-route="friends"]').click(); await page.locator('#friend-name').fill('ぽろん'); await page.locator('#friend-name-form button').click();
  await page.locator('[data-play-tab="journal"]').click(); expect(await page.locator('.journal-entry.found').count()).toBeGreaterThanOrEqual(5);
  await page.screenshot({ path: testInfo.outputPath('published-game-notebook.png') });
  await page.locator('[data-play-tab="decor"]').click(); await page.locator('[data-buy="shell"]').click();
  expect(await page.evaluate(() => window.__aquarium.game.state.props.shell?.on)).toBe(true);
  await page.locator('#play-close').click(); await page.screenshot({ path: testInfo.outputPath('published-game-tank.png') });
  await page.reload(); await page.waitForFunction(() => !!window.__aquarium?.game);
  expect(await page.evaluate(() => window.__aquarium.game.friend(1).name)).toBe('ぽろん');
  expect(await page.evaluate(() => window.__aquarium.game.state.owned)).toContain('shell'); expect(errors).toEqual([]);
});

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

test('published retro music and fish effects produce recorded audio and can be muted', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Capture the app's own synthesized output, before the browser's audio device.
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function(this: AudioContext) {
      const analyser = create.call(this), destination = this.createMediaStreamDestination();
      analyser.connect(destination);
      window.__audioCapture = { context: this, stream: destination.stream, chunks: [] };
      return analyser;
    };
  });
  await page.goto('./?tank&debug'); await page.waitForFunction(() => !!window.__aquarium);
  await page.locator('#tank-sound').click();
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.unlocked)).toBe(true);
  await page.locator('#tank-pause').click();
  await startCapture(page);
  await page.locator('#tank canvas').focus(); await page.locator('#tank canvas').press('ArrowRight'); await page.locator('#tank canvas').press('Enter');
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.effectsPlayed)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__aquarium.audio.lastMidi)).toBe(72);
  expect(await page.evaluate(() => window.__aquarium.audio.lastDelay)).toBeLessThanOrEqual(.076);
  await page.waitForTimeout(450);
  const effectPeak = await capturedPeak(page); expect(effectPeak).toBeGreaterThan(.002); expect(effectPeak).toBeLessThan(.5);
  await page.locator('#tank-pause').click(); await page.locator('#tank-exit').click();
  await page.locator('#sound-track').selectOption('bubbles'); await page.locator('#sound-timbre').selectOption('pluck');
  await expect.poll(() => page.evaluate(() => window.__aquarium.audio.playing)).toBe(true);
  await startCapture(page); await page.waitForTimeout(1800);
  const musicPeak = await capturedPeak(page); expect(musicPeak).toBeGreaterThan(.001); expect(musicPeak).toBeLessThan(.5);
  await page.screenshot({ path: testInfo.outputPath('published-sound-controls.png'), fullPage: true });
  await page.locator('#sound-toggle').click(); await expect.poll(() => page.evaluate(() => window.__aquarium.audio.contextState)).toBe('suspended');
  console.log(`Recorded audio peaks: effect=${effectPeak.toFixed(4)}, music=${musicPeak.toFixed(4)}`);
  expect(errors).toEqual([]);
});
