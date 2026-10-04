import { DEFAULTS, QUALITY, type Fish, type Settings } from './types';

const icons = {
  settings: '<path d="m9.5 3-.7 2a7 7 0 0 0-1.5.9l-2.1-.4-2 3.4L4.7 10a8 8 0 0 0 0 1.8l-1.5 1.1 2 3.5 2.1-.4a7 7 0 0 0 1.5.9l.7 2h4l.7-2a7 7 0 0 0 1.5-.9l2.1.4 2-3.5-1.5-1.1a8 8 0 0 0 0-1.8l1.5-1.1-2-3.4-2.1.4a7 7 0 0 0-1.5-.9l-.7-2z"/><circle cx="11.5" cy="10.9" r="3"/>',
  play: '<path d="m8 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', reset: '<path d="M4 9a8 8 0 1 1 .6 7M4 3v6h6"/>',
  fish: '<path d="M19 12c-3-6-10-6-14 0 4 6 11 6 14 0Z"/><path d="m19 12 3-4v8zM3 11v2"/><circle cx="8" cy="11" r=".6"/>',
  brain: '<path d="M12 5c-5-5-11 1-7 5-5 3-1 10 3 8 1 4 4 2 4 0V5Zm0 0c5-5 11 1 7 5 5 3 1 10-3 8-1 4-4 2-4 0"/><path d="M8 7v4H5m11-4v4h3M8 16h4m4-2h-4"/>',
  food: '<path d="M12 3v8m-3-3 3 3 3-3"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="19" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
export const icon = (name: keyof typeof icons, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const stepper = (key: string, label: string, english: string, value: number, min: number, max: number) => `<div class="setting-row"><label for="${key}">${label}<small>${english}</small></label><div class="stepper"><button data-step="${key}" data-delta="-1" aria-label="${label}を減らす">−</button><output id="${key}-value">${value}</output><button data-step="${key}" data-delta="1" aria-label="${label}を増やす">＋</button></div></div><input id="${key}" data-setting="${key}" type="range" min="${min}" max="${max}" value="${value}" aria-label="${label}"><div class="range-labels"><span>${min}</span><span>${max}</span></div>`;
const range = (key: string, label: string, value: number, low: string, high: string) => `<div class="setting-row compact"><label for="${key}">${label}</label><output id="${key}-value">${Math.round(value * 100)}%</output></div><input id="${key}" data-setting="${key}" type="range" min="0" max="100" value="${value * 100}"><div class="range-labels"><span>${low}</span><span>${high}</span></div>`;

export class UI {
  onSetting: (key: keyof Settings, value: Settings[keyof Settings]) => void = () => {};
  onPause = () => {}; onReset = () => {}; onFeed = () => {}; onInspect = () => {}; onCloseInspector = () => {};
  private lastAnnouncement = ''; private toastTimer = 0;
  constructor(private settings: Settings) {
    document.querySelector('#app')!.innerHTML = `
      <header class="site-header"><a class="brand" href="./" aria-label="FlyFish Aquarium ホーム"><img src="./favicon.svg" alt="" width="38" height="38"><span>FlyFish<span class="brand-light"> Aquarium</span></span></a><div class="header-right"><span class="header-note"><span class="tiny-dot"></span> a little life, a little science</span><button class="icon-button" id="about-open" aria-label="この水槽について">${icon('info')}</button><button class="icon-button settings-toggle" id="settings-toggle" aria-label="設定パネルを開閉" aria-expanded="true">${icon('settings')}</button></div></header>
      <main><div class="intro"><div><div class="eyebrow">YOUR LITTLE CONNECTED WORLD</div><h1>小さな水槽、<span>大きな好奇心。</span></h1><p>ハエの神経回路で泳ぐ魚たち。ふれて、混ぜて、じっくり眺めよう。</p></div><div class="live-pill"><span class="tiny-dot"></span><span id="live-label">水槽は活動中</span></div></div>
      <div class="workspace"><section class="aquarium-card" aria-label="水槽"><div class="tank-toolbar"><div class="tank-title"><span class="tiny-dot"></span><span>THE AQUARIUM</span><span class="tank-number">01</span></div><div class="tank-actions"><button id="pause" class="icon-button" aria-label="一時停止" aria-pressed="false">${icon('pause', 17)}</button><button id="reset" class="icon-button" aria-label="水槽をリセット">${icon('reset', 17)}</button><span class="divider"></span><button id="fullscreen" class="icon-button" aria-label="水槽を全画面表示">${icon('expand', 17)}</button></div></div>
      <div id="tank"><div class="loading" id="loading"><img src="./favicon.svg" alt=""><span>小さな世界を準備中…</span></div><div class="tank-tag"><span class="tag-dot"></span><span id="tank-mode">HYBRID ECOSYSTEM</span></div><div class="tank-bottom-label"><span id="tank-fish-count">24</span> little swimmers <span class="label-dot">·</span> make yourself at home</div><div class="toast" id="toast" role="status"></div><div class="inspect-card" id="inspector" hidden></div></div>
      <div class="tank-footer"><div class="tank-metric">${icon('fish', 19)}<strong id="metric-fish">24</strong><span>匹の魚</span></div><div class="tank-metric brain-metric">${icon('brain', 18)}<span>Fly Brain</span><strong id="metric-brain">70%</strong></div><div class="fps-metric"><span class="tiny-dot"></span><span id="fps">60</span> FPS</div></div>
      <div class="interaction-guide"><div>${icon('food', 21)}<span><strong>餌をあげる</strong><small>空いている場所をクリック</small></span></div><div>${icon('fish', 21)}<span><strong>びっくりさせる</strong><small>魚をクリック</small></span></div><button id="inspect-mode">${icon('brain', 21)}<span><strong>脳をのぞく</strong><small>Shift ＋ クリック / タップで選択</small></span></button></div>
      <div class="observation-note"><span class="note-spark">✳</span><p>同じ水槽、違う泳ぎ方。<span>脳のブレンドを変えると、魚たちのふるまいも変わります。</span></p><button id="feed-button">餌をひとつまみ ${icon('food', 17)}</button></div></section>
      <aside class="settings-panel" id="settings-panel" aria-label="水槽の設定"><div class="panel-header"><div>${icon('settings', 18)}<h2>水槽の設定</h2></div><button class="text-button" id="settings-reset">初期値に戻す</button></div>
      <section class="brain-section"><div class="section-label">BRAIN CONTROL <span>01</span></div><div class="brain-heading">泳ぎ方を、ブレンド。</div><p class="setting-description">神経回路とプログラムAIのバランス</p><div class="preset-buttons"><button data-preset=".9">Fly Brain</button><button data-preset=".5" class="active">Hybrid</button><button data-preset="0">Program</button></div><div class="brain-values"><div><span class="brain-label">${icon('brain', 15)} Fly Brain</span><strong id="fly-value">70<span>%</span></strong></div><div class="program-value"><span class="brain-label">Program</span><strong id="program-value">30<span>%</span></strong></div></div><input id="flyWeight" data-setting="flyWeight" type="range" min="0" max="100" value="70" aria-label="ハエ脳の比率"><div class="range-labels"><span>Program</span><span>Fly Brain</span></div><div class="brain-visual"><div class="neural-graph" aria-hidden="true"><svg viewBox="0 0 230 48"><g stroke="#8caa82" stroke-width=".7" opacity=".45"><path d="M8 22 38 10 66 25 96 9 128 22 163 8 195 24 220 13M8 22 38 39 66 25 96 40 128 22 163 40 195 24 220 38M38 10 38 39M96 9 96 40M163 8 163 40M38 10 96 40M96 9 163 40M128 22 195 24"/></g><g fill="#789876"><circle cx="8" cy="22" r="3"/><circle cx="38" cy="10" r="3"/><circle cx="38" cy="39" r="3"/><circle cx="66" cy="25" r="4"/><circle cx="96" cy="9" r="3"/><circle cx="96" cy="40" r="3"/><circle cx="128" cy="22" r="4"/><circle cx="163" cy="8" r="3"/><circle cx="163" cy="40" r="3"/><circle cx="195" cy="24" r="4"/><circle cx="220" cy="13" r="3"/><circle cx="220" cy="38" r="3"/></g></svg></div><div><span class="tiny-dot"></span><span id="brain-status">神経回路を読み込み中</span></div></div></section>
      <section><div class="section-label">LITTLE SWIMMERS <span>02</span></div>${stepper('fishCount', '魚の数', 'Fish count', 24, 12, 40)}${range('variation', '個体差', .4, '小さく', '大きく')}</section>
      <section><div class="section-label">ENVIRONMENT <span>03</span></div>${stepper('predators', '敵の数', 'Predators · 魚は減りません', 1, 0, 8)}${stepper('stations', '餌場の数', 'Feeding stations', 2, 0, 6)}<div class="toggles">${[['seaweed', '海藻'], ['rocks', '岩'], ['bubbles', '泡']].map(([key, label]) => `<label class="toggle-chip"><input type="checkbox" data-setting="${key}" checked><span>${label}</span></label>`).join('')}</div></section>
      <details class="advanced"><summary>インタラクション・計算設定 ${icon('chevron', 15)}</summary><div class="advanced-content"><label class="checkbox-row"><input type="checkbox" data-setting="scare" checked>魚をクリックで驚かせる</label>${range('startle', '刺激の強さ', .8, '弱い', '強い')}${range('nearby', '周辺の魚への伝播', .6, 'なし', '強い')}<div class="setting-row"><label for="quality">脳の計算品質</label><select id="quality" data-setting="quality"><option value="low">Low · 5 Hz</option><option value="medium" selected>Medium · 10 Hz</option><option value="high">High · 15 Hz</option></select></div><label class="checkbox-row"><input id="debug-toggle" type="checkbox">開発用の行動ログ</label></div></details>
      <div class="panel-footnote">ひと休みのおともに。<br>魚たちは、あなたが見ていない間も泳ぎます。</div></aside></div>
      <footer class="page-footer"><span>Made of pixels. Powered by connections.</span><button class="text-button" id="credits-open">データ出典とライセンス ${icon('chevron', 13)}</button><a href="https://github.com/naru18vr/FlyFish-Aquarium" target="_blank" rel="noreferrer">GitHub ↗</a></footer></main>
      <dialog id="about"><div class="dialog-header"><span class="eyebrow">A LITTLE LIFE, A LITTLE SCIENCE</span><button class="icon-button" id="about-close" aria-label="閉じる">${icon('close')}</button></div><h2>FlyFish Aquarium</h2><p>ショウジョウバエの公開コネクトーム由来の神経回路を、魚の行動判断に利用したドット絵アクアリウムです。</p><p>魚は餌や敵、仲間、壁、クリック刺激を感知します。ハエ脳とプログラムAIの比率を変え、ふるまいの違いを観察してみてください。</p><div class="about-data"><h3>この水槽で動いている回路</h3><p><strong>FlyWire FAFB v630</strong> の中央複合体（CX）と一部の下行ニューロンから抽出した、最大768ニューロンの接続データ。軽量なLIFモデルをWeb Worker内で計算し、活動状態は魚ごとに独立しています。</p><p>感覚の投射先と魚の運動への読み出しは、このアプリ独自の人工的な対応付けです。接続を切り出し、重みを正規化しているため、生物学的に検証された行動モデルや全脳の完全再現ではありません。</p><h3>出典・ライセンス</h3><p>データ：FlyWire Consortium、Dorkenwald et al. (2024)、Lin et al. (2024)。<a href="https://github.com/murthylab/flywire-network-analysis" target="_blank" rel="noreferrer">Murthy Lab公開データ</a>のv630スナップショットを利用しています。</p><p>コネクトームと派生JSON：<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a>（非商用）。<a href="https://join.flywire.ai/guidelines" target="_blank" rel="noreferrer">FlyWire公式利用ガイドライン</a><br>本アプリのコード・オリジナルドット絵：MIT。PixiJS / Vite：MIT。TypeScript：Apache-2.0。</p></div><button class="primary-button" id="about-done">水槽にもどる</button></dialog>
      <div class="sr-only" id="announcements" aria-live="polite"></div>`;
    this.bind(); this.sync();
  }
  private bind() {
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting as keyof Settings;
        const value = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : key === 'quality' ? input.value : ['fishCount', 'predators', 'stations'].includes(key) ? +input.value : +input.value / 100;
        this.onSetting(key, value as Settings[keyof Settings]); this.sync();
      });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => button.onclick = () => {
      const key = button.dataset.step as 'fishCount' | 'predators' | 'stations';
      const input = document.getElementById(key) as HTMLInputElement;
      this.onSetting(key, Math.min(+input.max, Math.max(+input.min, this.settings[key] + +(button.dataset.delta!)))); this.sync();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.onclick = () => { this.onSetting('flyWeight', +button.dataset.preset!); this.sync(); });
    document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => this.onPause();
    document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => this.onReset();
    document.querySelector<HTMLButtonElement>('#feed-button')!.onclick = () => this.onFeed();
    document.querySelector<HTMLButtonElement>('#inspect-mode')!.onclick = () => this.onInspect();
    document.querySelector<HTMLButtonElement>('#settings-toggle')!.onclick = () => {
      const workspace = document.querySelector('.workspace')!;
      const closed = workspace.classList.toggle('settings-closed');
      document.querySelector('#settings-toggle')!.setAttribute('aria-expanded', String(!closed));
    };
    document.querySelector<HTMLButtonElement>('#settings-reset')!.onclick = () => { for (const [key, value] of Object.entries(DEFAULTS)) this.onSetting(key as keyof Settings, value); this.sync(); this.toast('設定を初期値に戻しました'); };
    document.querySelector<HTMLButtonElement>('#fullscreen')!.onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.aquarium-card')!.requestFullscreen(); }
      catch { this.toast('このブラウザーでは全画面表示が使えません'); }
    };
    const about = document.querySelector<HTMLDialogElement>('#about')!;
    for (const id of ['about-open', 'credits-open']) document.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => about.showModal();
    for (const id of ['about-close', 'about-done']) document.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => about.close();
    about.addEventListener('click', e => { if (e.target === about) { const r = about.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) about.close(); } });
  }
  sync() {
    for (const [key, value] of Object.entries(this.settings)) {
      const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-setting="${key}"]`);
      if (!input) continue;
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = value as boolean;
      else input.value = String(typeof value === 'number' && !['fishCount', 'predators', 'stations'].includes(key) ? Math.round(value * 100) : value);
      if (input instanceof HTMLInputElement && input.type === 'range') input.style.setProperty('--fill', `${(+input.value - +input.min) / (+input.max - +input.min) * 100}%`);
      const output = document.getElementById(`${key}-value`);
      if (output) output.textContent = String(['fishCount', 'predators', 'stations'].includes(key) ? value : `${Math.round(+value * 100)}%`);
    }
    document.querySelector('#fly-value')!.innerHTML = `${Math.round(this.settings.flyWeight * 100)}<span>%</span>`;
    document.querySelector('#program-value')!.innerHTML = `${Math.round((1 - this.settings.flyWeight) * 100)}<span>%</span>`;
    document.querySelector('#metric-brain')!.textContent = `${Math.round(this.settings.flyWeight * 100)}%`;
    document.querySelector('#metric-fish')!.textContent = String(this.settings.fishCount);
    document.querySelector('#tank-fish-count')!.textContent = String(this.settings.fishCount);
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.classList.toggle('active', +button.dataset.preset! === this.settings.flyWeight));
    document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => {
      const input = document.getElementById(button.dataset.step!) as HTMLInputElement;
      button.disabled = +button.dataset.delta! < 0 ? +input.value <= +input.min : +input.value >= +input.max;
    });
    document.querySelector('#tank-mode')!.textContent = this.settings.flyWeight === 0 ? 'PROGRAM ECOSYSTEM' : this.settings.flyWeight === 1 ? 'FLY BRAIN ECOSYSTEM' : 'HYBRID ECOSYSTEM';
  }
  pause(paused: boolean) {
    const button = document.querySelector('#pause')!;
    button.innerHTML = icon(paused ? 'play' : 'pause', 17); button.setAttribute('aria-label', paused ? '再開' : '一時停止'); button.setAttribute('aria-pressed', String(paused));
    document.querySelector('#live-label')!.textContent = paused ? '水槽はひと休み中' : '水槽は活動中';
    document.querySelector('.live-pill')!.classList.toggle('paused', paused);
  }
  inspecting(active: boolean) { document.querySelector('#inspect-mode')!.classList.toggle('active', active); document.querySelector('#tank')!.classList.toggle('inspect-mode', active); }
  brainReady(neurons: number, edges: number) { document.querySelector('#brain-status')!.textContent = `${neurons} neurons · ${QUALITY[this.settings.quality].hz} Hz`; document.querySelector('.brain-visual')!.setAttribute('title', `${edges.toLocaleString()} measured connections`); }
  toast(message: string) {
    const toast = document.querySelector('#toast')!; toast.textContent = message; toast.classList.add('visible');
    window.clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
    if (this.lastAnnouncement !== message) { document.querySelector('#announcements')!.textContent = message; this.lastAnnouncement = message; }
  }
  inspector(fish: Fish | undefined, workerMs: number) {
    const panel = document.querySelector<HTMLElement>('#inspector')!;
    if (!fish) { panel.hidden = true; return; }
    panel.hidden = false;
    const bar = (name: string, value: number, color: string) => `<div class="fish-state"><span>${name}</span><div><i style="width:${Math.round(value * 100)}%;background:${color}"></i></div><b>${Math.round(value * 100)}</b></div>`;
    const s = fish.sensory;
    const direction = (left: number, right: number, front: number) => Math.max(left, right, front) < .05 ? '—' : front > Math.max(left, right) * .9 ? 'FRONT' : left > right ? 'LEFT' : 'RIGHT';
    const debug = (document.querySelector('#debug-toggle') as HTMLInputElement).checked;
    panel.innerHTML = `<div class="inspector-heading"><span>FISH <strong>#${String(fish.id).padStart(2, '0')}</strong></span><button id="inspector-close" aria-label="個体情報を閉じる">${icon('close', 15)}</button></div><div class="fish-blend">Fly Brain ${Math.round(fish.flyWeight * 100)}% <span>Program ${Math.round(fish.programWeight * 100)}%</span></div>${bar('Energy', fish.energy, '#acd496')}${bar('Fear', fish.fear, '#e3b68d')}${bar('Hunger', fish.hunger, '#d7c391')}<div class="stimuli"><span>FOOD <b>${direction(s.foodLeft, s.foodRight, s.foodFront)}</b></span><span>ENEMY <b>${direction(s.enemyLeft, s.enemyRight, s.enemyFront)}</b></span><span>WALL <b>${direction(s.wallLeft, s.wallRight, s.wallFront)}</b></span></div><div class="activity-label">BRAIN ACTIVITY <span>${fish.spikes} spikes/tick</span></div><div class="activity-bars">${fish.activity.map(a => `<i style="height:${Math.max(3, a * 24)}px;opacity:${.3 + a * .7}"></i>`).join('')}</div><div class="action-label">${fish.action.turnLeft > fish.action.turnRight + .1 ? '↶ TURN LEFT' : fish.action.turnRight > fish.action.turnLeft + .1 ? '↷ TURN RIGHT' : '→ SWIM'} <span>${fish.action.accelerate > .6 ? 'ACCELERATE' : fish.action.brake > .5 ? 'BRAKE' : 'CRUISE'}</span></div>${debug ? `<pre class="debug">Worker ${workerMs.toFixed(1)} ms\n${JSON.stringify({ sensory: fish.sensory, fly: fish.fly, program: fish.program, final: fish.action }, null, 2)}</pre>` : ''}`;
    document.querySelector<HTMLButtonElement>('#inspector-close')!.onclick = () => this.onCloseInspector();
  }
}
