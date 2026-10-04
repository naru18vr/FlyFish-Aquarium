import './style.css';
import { Aquarium } from './simulation';
import { AquariumRenderer } from './renderer';
import { UI } from './ui';
import { BOUNDS, clamp, HEIGHT, WIDTH } from './math';
import { DEFAULTS, QUALITY, type BrainRequest, type BrainResponse, type Connectome, type Settings } from './types';

// Preserve only recognized, bounded values. Storage may be unavailable in private mode.
function loadSettings(): Settings {
  const settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('flyfish-settings-v1') || '{}');
    for (const key of Object.keys(settings) as (keyof Settings)[]) {
      const value = saved[key];
      if (typeof settings[key] === 'boolean' && typeof value === 'boolean') Object.assign(settings, { [key]: value });
      else if (key === 'quality' && ['low', 'medium', 'high'].includes(value)) settings.quality = value;
      else if (typeof settings[key] === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        const limits = key === 'fishCount' ? [12, 40] : key === 'predators' ? [0, 8] : key === 'stations' ? [0, 6] : [0, 1];
        Object.assign(settings, { [key]: limits[1] > 1 ? Math.round(clamp(value, ...limits as [number, number])) : clamp(value) });
      }
    }
  } catch { /* Safe defaults when storage is blocked or corrupt. */ }
  return settings;
}
const settings = loadSettings();
const ui = new UI(settings), sim = new Aquarium(settings), renderer = new AquariumRenderer();
let paused = false, inspecting = false, ready = false, busy = false, workerMs = 0, brainTime = 0;
let worker: Worker | null = null, brainFailed = false;
const send = (request: BrainRequest) => worker?.postMessage(request);
ui.onSetting = (key, value) => {
  if (brainFailed && key === 'flyWeight' && +value > 0) { ui.toast('神経回路を再読み込みするにはページを更新してください'); return; }
  Object.assign(settings, { [key]: value }); sim.applySettings();
  try { localStorage.setItem('flyfish-settings-v1', JSON.stringify(settings)); } catch { /* Optional persistence. */ }
  if (key === 'quality') { ready = false; send({ type: 'quality', quality: settings.quality }); }
};
ui.onPause = () => { paused = !paused; ui.pause(paused); };
ui.onReset = () => { sim.reset(); send({ type: 'reset' }); ui.toast('新しいひと泳ぎ、はじまり。'); };
ui.onFeed = () => { sim.feed(WIDTH * (.3 + Math.random() * .4)); ui.toast('餌をひとつまみ。集まってくるかな？'); };
ui.onInspect = () => { inspecting = !inspecting; ui.inspecting(inspecting); if (inspecting) ui.toast('気になる魚をタップして、脳をのぞこう'); };
ui.onCloseInspector = () => { sim.selected = null; ui.inspector(undefined, 0); };

async function startBrain() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/connectome.json`);
    if (!response.ok) throw new Error(`Connectome HTTP ${response.status}`);
    const data: Connectome = await response.json();
    if (!data.neurons?.length || !data.edges?.length) throw new Error('Empty connectome');
    worker = new Worker(new URL('./brain/worker.ts', import.meta.url), { type: 'module' });
    const fallback = () => {
      ready = false; busy = false; brainFailed = true; worker?.terminate(); worker = null;
      settings.flyWeight = 0; ui.sync(); document.querySelector('#brain-status')!.textContent = '回路を読み込めません · Programで遊泳中';
      ui.toast('神経回路を読み込めませんでした。Programで遊泳を続けます。');
    };
    worker.onerror = fallback;
    worker.onmessage = ({ data }: MessageEvent<BrainResponse>) => {
      if (data.type === 'ready') { ready = true; ui.brainReady(data.neurons, data.edges); }
      else {
        busy = false; workerMs = data.elapsed;
        for (const result of data.fish) {
          const fish = sim.fish.find(f => f.id === result.id);
          if (fish) { fish.fly = result.motor; fish.activity = result.activity; fish.spikes = result.spikes; }
        }
      }
    };
    send({ type: 'init', data, quality: settings.quality });
  } catch (error) {
    console.error(error); brainFailed = true; settings.flyWeight = 0; ui.sync();
    document.querySelector('#brain-status')!.textContent = 'データ取得失敗 · Programで遊泳中';
    ui.toast('接続データを取得できませんでした。Programで遊泳を続けます。');
  }
}
async function start() {
  try { await renderer.init(document.querySelector('#tank')!); }
  catch (error) {
    console.error(error); document.querySelector('#loading')!.textContent = '描画を開始できませんでした。WebGL対応のブラウザーで、ページを再読み込みしてください。'; return;
  }
  document.querySelector('#loading')!.remove();
  renderer.app.canvas.addEventListener('pointerdown', event => {
    const rect = renderer.app.canvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
    if (point.y > BOUNDS.bottom + 30) return;
    const action = sim.interact(point, event.shiftKey || inspecting);
    if (action === 'scare') { renderer.effect(point, action); ui.toast('びっくり！ 刺激が神経回路へ伝わりました'); }
    else if (action === 'feed') { renderer.effect(point, action); ui.toast('餌がゆっくり沈んでいきます'); }
    ui.inspector(sim.fish.find(f => f.id === sim.selected), workerMs);
  });
  void startBrain();
  let last = performance.now(), uiTime = 0, frames = 0, fpsTime = 0;
  function frame(now: number) {
    const elapsed = (now - last) / 1000; last = now;
    const dt = Math.min(elapsed, .04);
    if (!paused && !document.hidden) {
      sim.update(dt); brainTime += dt;
      if (ready && !busy && brainTime >= 1 / QUALITY[settings.quality].hz) {
        brainTime %= 1 / QUALITY[settings.quality].hz; busy = true;
        send({ type: 'tick', fish: sim.fish.map(f => ({ id: f.id, sensory: f.sensory, noise: .1 + (f.traits.brainNoise + 1) * settings.variation * .2 })) });
      }
    }
    renderer.render(sim, paused || document.hidden ? 0 : dt);
    uiTime += dt; frames++; fpsTime += elapsed;
    if (uiTime >= .2) { uiTime = 0; ui.inspector(sim.fish.find(f => f.id === sim.selected), workerMs); }
    if (fpsTime >= 1) { document.querySelector('#fps')!.textContent = String(Math.round(frames / fpsTime)); frames = 0; fpsTime = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only diagnostics are opt-in and never run neural computation on main.
  if (new URLSearchParams(location.search).has('debug')) {
    Object.defineProperty(window, '__aquarium', { value: { sim, get ready() { return ready; }, get workerMs() { return workerMs; }, get paused() { return paused; } } });
    (document.querySelector('#debug-toggle') as HTMLInputElement).checked = true;
  }
}
void start();
