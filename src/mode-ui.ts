import type { AquariumGame } from './game';
import type { UI } from './ui';

export type InteractionMode = 'touch' | 'pet' | 'follow' | 'inspect';
const MODES = { touch: ['つつく', '魚をタップするとびっくり。空いている場所は餌やり。'], pet: ['なでる', '魚をタップすると仲良し度アップ。驚かせません。'], follow: ['一緒に泳ぐ', '水槽でマウスを動かすか、指でなぞると近くの魚が寄ってきます。'], inspect: ['脳を見る', '魚をタップして選択すると、脳と行動の情報が開きます。'] } as const;

export class ModeUI {
  onSelect = (_mode: InteractionMode) => {};
  private key = '';
  constructor(private game: AquariumGame, private ui: UI) {
    document.querySelector('#tank')!.insertAdjacentHTML('beforebegin', `<div class="mode-hud"><button id="mode-toggle" aria-expanded="false" aria-controls="mode-picker"><small>現在の操作</small><strong id="current-mode" role="status"></strong><span>切り替え ▾</span></button><div id="mode-picker" hidden><p id="mode-help"></p><div>${Object.entries(MODES).map(([id, [label]]) => `<button data-interaction-mode="${id}" aria-pressed="false">${label}<span class="mode-check" aria-hidden="true">✓</span></button>`).join('')}</div><p>空いている場所のタップは餌やり。放置の成長はどのモードでも続きます。</p><p id="mode-running"></p></div></div>`);
    document.querySelector('.play-wallet')!.insertAdjacentHTML('afterend', '<div id="play-current-mode" class="play-help" role="status"><strong id="play-mode-brief"></strong><span class="play-mode-detail"></span></div>');
    const toggle = document.querySelector<HTMLButtonElement>('#mode-toggle')!;
    toggle.onclick = () => { const picker = document.querySelector<HTMLElement>('#mode-picker')!; picker.hidden = !picker.hidden; toggle.setAttribute('aria-expanded', String(!picker.hidden)); };
    document.querySelectorAll<HTMLButtonElement>('[data-interaction-mode]').forEach(button => button.onclick = () => {
      this.onSelect(button.dataset.interactionMode as InteractionMode); this.close(); this.refresh();
      document.querySelector<HTMLCanvasElement>('#tank canvas')?.focus({ preventScroll: true });
    });
    document.addEventListener('pointerdown', event => { if (!(event.target as Element).closest('.mode-hud')) this.close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector<HTMLElement>('#mode-picker')!.hidden) { event.preventDefault(); event.stopImmediatePropagation(); this.close(); toggle.focus(); } }, true);
  }
  private close() { document.querySelector<HTMLElement>('#mode-picker')!.hidden = true; document.querySelector('#mode-toggle')!.setAttribute('aria-expanded', 'false'); }
  refresh() {
    const inspecting = document.querySelector('#inspect-mode')!.getAttribute('aria-pressed') === 'true';
    const { gentle, followPointer } = this.game.state;
    const mode: InteractionMode = inspecting ? 'inspect' : gentle ? 'pet' : followPointer ? 'follow' : 'touch';
    const music = !!this.game.phrase;
    const label = music ? '音あそび中' : `${MODES[mode][0]}モード`;
    const hint = music ? '光る輪の魚を順番にタップして演奏します。' : mode === 'touch' ? this.ui.touchModeHelp() : MODES[mode][1];
    const follow = followPointer ? inspecting || music ? '追従は今お休み中' : 'マウス追従オン' : 'マウス追従オフ';
    const paused = document.querySelector('#pause')!.getAttribute('aria-pressed') === 'true';
    const running = `${this.ui.tankActive ? '画面いっぱいの水槽' : '通常画面'} · ${paused ? '水槽は休止中（再開で魚が泳ぎます）' : '水槽は活動中'} · ${follow}`;
    const key = [label, hint, running, this.ui.settingsModeLabel()].join('|');
    if (key === this.key) return; this.key = key;
    document.querySelector('#current-mode')!.textContent = label;
    document.querySelector('#mode-help')!.textContent = hint;
    document.querySelector('#mode-running')!.textContent = `${running}。泳ぎ方：${this.ui.settingsModeLabel()}`;
    document.querySelector('#play-mode-brief')!.textContent = `現在：${label} · ${follow}。`;
    document.querySelector('.play-mode-detail')!.textContent = `${hint} ページの選択は設定を開きます。遊びの開始ボタンを押すと水槽に戻ります。`;
    document.querySelectorAll<HTMLButtonElement>('[data-interaction-mode]').forEach(b => b.setAttribute('aria-pressed', String(!music && b.dataset.interactionMode === mode)));
    for (const [id, active] of [['friend-pet', !music && !inspecting && gentle], ['friend-follow', !music && !inspecting && followPointer]] as const) document.querySelector(`#${id}`)!.setAttribute('aria-pressed', String(active));
    document.querySelector('#mode-toggle')!.setAttribute('aria-label', `現在：${label}。操作モードを切り替える`);
  }
}
