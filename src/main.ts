import './style.css';
import { Aquarium } from './simulation';
import { AquariumRenderer } from './renderer';
import { UI } from './ui';
import { isConnectome } from './brain/connectome';
import { FISH_SPECIES, PREDATOR_KINDS, type FishSelection, type PredatorSelection } from './species';
import { BASE_HEIGHT, BASE_WIDTH, BOUNDS, clamp, HEIGHT, tankSize, WIDTH } from './math';
import { DEFAULTS, QUALITY, idleMotor, type BrainRequest, type BrainResponse, type Settings } from './types';
import { AquariumAudio, readAudioSettings, type AudioSettings } from './audio';

// Preserve only recognized, bounded values. Storage may be unavailable in private mode.
function loadSettings(): Settings {
  const settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('flyfish-settings-v1') || '{}');
    for (const key of Object.keys(settings) as (keyof Settings)[]) {
      const value = saved[key];
      if (typeof settings[key] === 'boolean' && typeof value === 'boolean') Object.assign(settings, { [key]: value });
      else if (key === 'quality' && ['low', 'medium', 'high'].includes(value)) settings.quality = value;
      else if (key === 'fishSpecies' && ['mixed', ...FISH_SPECIES].includes(value)) settings.fishSpecies = value as FishSelection;
      else if (key === 'predatorKind' && ['mixed', ...PREDATOR_KINDS].includes(value)) settings.predatorKind = value as PredatorSelection;
      else if (typeof settings[key] === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        const limits = key === 'fishCount' ? [12, 40] : key === 'predators' ? [0, 8] : key === 'stations' ? [0, 6] : [0, 1];
        Object.assign(settings, { [key]: limits[1] > 1 ? Math.round(clamp(value, ...limits as [number, number])) : clamp(value) });
      }
    }
  } catch { /* Safe defaults when storage is blocked or corrupt. */ }
  return settings;
}
const settings = loadSettings();
let savedAudio: unknown;
try { savedAudio = JSON.parse(localStorage.getItem('flyfish-sound-v1') || 'null'); } catch { /* Optional storage. */ }
const sound = new AquariumAudio(readAudioSettings(savedAudio));
const ui = new UI(settings, sound.settings), sim = new Aquarium(settings), renderer = new AquariumRenderer();
sound.onChange = () => ui.soundState(sound.snapshot);
ui.soundState(sound.snapshot);
function saveSound() { try { localStorage.setItem('flyfish-sound-v1', JSON.stringify(sound.settings)); } catch { /* Optional persistence. */ } }
ui.onSoundSetting = (key, value) => {
  sound.change(key, value as AudioSettings[typeof key]); saveSound();
  if (sound.settings.enabled) void sound.activate();
};
ui.onSoundToggle = () => {
  const state = sound.snapshot;
  if (!state.enabled || state.unlocked || state.unavailable) sound.change('enabled', !state.enabled);
  saveSound();
  if (sound.settings.enabled) void sound.activate();
};
ui.onSoundPreview = () => {
  sound.change('enabled', true); sound.change('effects', true); saveSound();
  void sound.fish(3).then(note => { if (note) renderer.effect({ x: WIDTH / 2, y: HEIGHT / 2 }, 'note', note.midi); });
};
document.addEventListener('visibilitychange', () => sound.visibility(document.hidden));
window.addEventListener('pagehide', () => sound.visibility(true));
window.addEventListener('pageshow', () => sound.visibility(document.hidden));
const playFish = (id: number, point: { x: number; y: number }) => {
  const position = { ...point };
  void sound.fish(id, point.x / WIDTH * 1.4 - .7).then(note => { if (note) renderer.effect(position, 'note', note.midi); });
};
let paused = false, inspecting = false, ready = false, busy = false, workerMs = 0, brainTime = 0;
let worker: Worker | null = null, brainFailed = false;
let revision = 0, workerTimer = 0;
const fallback = () => {
  if (brainFailed) return;
  window.clearTimeout(workerTimer);
  ready = false; busy = false; brainFailed = true; worker?.terminate(); worker = null;
  settings.flyWeight = 0; ui.sync();
  document.querySelector('#brain-status')!.textContent = '回路を読み込めません · Programで遊泳中';
  ui.toast('神経回路を読み込めませんでした。Programで遊泳を続けます。');
};
const send = (request: BrainRequest) => {
  if (!worker) return;
  window.clearTimeout(workerTimer);
  workerTimer = window.setTimeout(fallback, 15_000);
  try { worker.postMessage(request); } catch { fallback(); }
};
const restartBrain = () => {
  revision++; ready = false; busy = false; brainTime = 0;
  for (const fish of sim.fish) { fish.fly = idleMotor(); fish.spikes = 0; fish.activity.fill(0); }
};
ui.onSetting = (key, value) => {
  if (brainFailed && key === 'flyWeight' && +value > 0) { ui.toast('神経回路を再読み込みするにはページを更新してください'); return; }
  Object.assign(settings, { [key]: value }); sim.applySettings();
  try { localStorage.setItem('flyfish-settings-v1', JSON.stringify(settings)); } catch { /* Optional persistence. */ }
  if (key === 'quality') { restartBrain(); send({ type: 'quality', revision, quality: settings.quality }); }
};
ui.onPause = () => { paused = !paused; ui.pause(paused); sound.pause(paused); };
ui.onReset = () => { sim.reset(); restartBrain(); send({ type: 'reset', revision }); ui.inspector(undefined, 0); ui.toast('新しいひと泳ぎ、はじまり。'); };
ui.onFeed = () => { sim.feed(WIDTH * (.3 + Math.random() * .4)); void sound.feed(); ui.toast('餌をひとつまみ。集まってくるかな？'); };
ui.onInspect = () => { inspecting = !inspecting; ui.inspecting(inspecting); if (inspecting) ui.toast('気になる魚をタップして、脳をのぞこう'); };
ui.onCloseInspector = () => { sim.selected = null; ui.inspector(undefined, 0); };
function syncTankSize() {
  const tank = document.querySelector<HTMLElement>('#tank')!;
  const size = ui.tankActive ? tankSize(tank.clientWidth, tank.clientHeight) : { width: BASE_WIDTH, height: BASE_HEIGHT };
  if (size.width !== WIDTH || size.height !== HEIGHT) { sim.resize(size.width, size.height); renderer.resize(); }
}
ui.onTankMode = () => {
  sim.selected = null; inspecting = false; ui.inspecting(false); ui.inspector(undefined, 0);
  syncTankSize();
};

async function startBrain() {
  const controller = new AbortController();
  const fetchTimer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/connectome.json`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Connectome HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!isConnectome(data)) throw new Error('Invalid connectome');
    worker = new Worker(new URL('./brain/worker.ts', import.meta.url), { type: 'module' });
    worker.onerror = event => { event.preventDefault(); fallback(); };
    worker.onmessageerror = fallback;
    worker.onmessage = ({ data }: MessageEvent<BrainResponse>) => {
      if (data.revision !== revision) return;
      window.clearTimeout(workerTimer);
      if (data.type === 'ready') { ready = true; busy = false; ui.brainReady(data.neurons, data.edges); }
      else {
        busy = false; workerMs = data.elapsed;
        for (const result of data.fish) {
          const fish = sim.fish.find(f => f.id === result.id);
          if (fish) { fish.fly = result.motor; fish.activity = result.activity; fish.spikes = result.spikes; }
        }
      }
    };
    send({ type: 'init', revision, data, quality: settings.quality });
  } catch (error) {
    console.error(error); fallback();
  } finally { window.clearTimeout(fetchTimer); }
}
async function start() {
  try { await renderer.init(document.querySelector('#tank')!); }
  catch (error) {
    console.error(error); document.querySelector('#loading')!.textContent = '描画を開始できませんでした。WebGL対応のブラウザーで、ページを再読み込みしてください。'; return;
  }
  document.querySelector('#loading')!.remove();
  new ResizeObserver(syncTankSize).observe(document.querySelector('#tank')!);
  syncTankSize();
  renderer.app.canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const rect = renderer.app.canvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
    if (point.x < 0 || point.x > WIDTH || point.y < BOUNDS.top || point.y > BOUNDS.bottom + 30) return;
    const tapped = sim.pick(point);
    if (tapped && !event.shiftKey && !inspecting) playFish(tapped.id, point);
    const action = sim.interact(point, event.shiftKey || inspecting);
    if (action === 'scare') { renderer.effect(point, action); ui.toast('びっくり！ 刺激が神経回路へ伝わりました'); }
    else if (action === 'feed') { renderer.effect(point, action); void sound.feed(); ui.toast('餌がゆっくり沈んでいきます'); }
    ui.inspector(sim.fish.find(f => f.id === sim.selected), workerMs);
  });
  renderer.app.canvas.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const index = sim.fish.findIndex(f => f.id === sim.selected);
      const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      sim.selected = sim.fish[(index < 0 ? delta > 0 ? 0 : sim.fish.length - 1 : (index + delta + sim.fish.length) % sim.fish.length)].id;
      ui.inspector(sim.fish.find(f => f.id === sim.selected), workerMs);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const fish = sim.fish.find(f => f.id === sim.selected);
      if (fish && !inspecting) {
        playFish(fish.id, fish);
        const action = sim.interact(fish); if (action === 'scare') { renderer.effect(fish, action); ui.toast('びっくり！ 刺激が神経回路へ伝わりました'); }
      } else if (!fish) ui.onFeed();
    } else if (event.key === 'Escape') {
      sim.selected = null; inspecting = false; ui.inspecting(false); ui.inspector(undefined, 0);
    }
  });
  void startBrain();
  let last = performance.now(), uiTime = 0, frames = 0, fpsTime = 0, accumulator = 0, pausedRenderTime = 1;
  function frame(now: number) {
    const elapsed = (now - last) / 1000; last = now;
    const dt = Math.min(elapsed, .1);
    if (!paused && !document.hidden) {
      accumulator += dt;
      while (accumulator >= 1 / 60) { sim.update(1 / 60); accumulator -= 1 / 60; brainTime += 1 / 60; }
      if (ready && !busy && brainTime >= 1 / QUALITY[settings.quality].hz) {
        brainTime %= 1 / QUALITY[settings.quality].hz; busy = true;
        send({ type: 'tick', revision, fish: sim.fish.map(f => ({ id: f.id, sensory: f.sensory, noise: .1 + (f.traits.brainNoise + 1) * settings.variation * .2 })) });
      }
    } else accumulator = 0;
    pausedRenderTime += elapsed;
    if (!document.hidden && (!paused || pausedRenderTime >= .2)) { renderer.render(sim, paused ? 0 : dt, Math.min(pausedRenderTime, .25)); pausedRenderTime = 0; frames++; }
    uiTime += dt; fpsTime += elapsed;
    if (uiTime >= .2) { uiTime = 0; ui.inspector(sim.fish.find(f => f.id === sim.selected), workerMs); }
    if (fpsTime >= 1) { document.querySelector('#fps')!.textContent = String(Math.round(frames / fpsTime)); frames = 0; fpsTime = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only diagnostics are opt-in and never run neural computation on main.
  if (new URLSearchParams(location.search).has('debug')) {
    Object.defineProperty(window, '__aquarium', { value: { sim, get audio() { return sound.snapshot; }, get width() { return WIDTH; }, get height() { return HEIGHT; }, get ready() { return ready; }, get workerMs() { return workerMs; }, get paused() { return paused; }, get brainFailed() { return brainFailed; } } });
    (document.querySelector('#debug-toggle') as HTMLInputElement).checked = true;
  }
  if (new URLSearchParams(location.search).has('tank')) ui.tankMode(true);
}
void start();
