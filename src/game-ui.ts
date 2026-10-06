import { AquariumGame, degreeOf, friendshipLabel, JOURNAL, NOTE_NAMES, PHRASES, SHOP, VISITORS, type VisitorKind } from './game';
import type { Aquarium } from './simulation';
import { FISH_PROFILES } from './species';
import { icon } from './ui';

export class GameUI {
  onDemo = (_ids: number[]) => {};
  onFeed = () => {};
  onCall = (_id: number) => {};
  onClose = () => {};
  onMusicStart = () => {};
  private dialog: HTMLDialogElement;
  private tab = 'friends'; private picked = 1; private fishKey = ''; private seenRevision = -1;
  private demonstrating = false;
  constructor(private game: AquariumGame, private sim: Aquarium) {
    document.querySelector('#tank')!.insertAdjacentHTML('beforeend', `<button id="play-open" class="play-open" aria-haspopup="dialog">${icon('info', 15)} 遊びノート <span id="play-shells">8</span></button><div id="music-hud" class="music-hud" hidden><strong id="music-title"></strong><div id="music-sequence"></div><p id="music-instruction"></p><div><button id="music-replay">お手本 ♪</button><button id="music-stop">おしまい</button></div></div><button id="visitor-catch" class="visitor-catch" hidden></button>`);
    document.querySelector('.observation-note')!.insertAdjacentHTML('afterend', `<div class="game-shelf"><div><span class="eyebrow">LITTLE DISCOVERIES</span><h2>眺めるほど、仲良くなる。</h2><p id="play-summary">魚との出会いを、遊びノートに。</p></div><button id="journal-open" aria-haspopup="dialog">図鑑と模様替え ${icon('chevron', 15)}</button></div>`);
    document.body.insertAdjacentHTML('beforeend', `<dialog id="play-notebook" aria-labelledby="play-title"><div class="play-header"><div><span class="eyebrow">YOUR AQUARIUM NOTEBOOK</span><h2 id="play-title">小さな遊びノート</h2></div><button id="play-close" class="icon-button" aria-label="遊びノートを閉じる">${icon('close')}</button></div><div class="play-wallet">貝殻 <strong id="notebook-shells">8</strong><span>発見や初めての演奏でもらえるよ。</span></div><nav class="play-tabs" aria-label="遊びノートのページ">${[['friends', 'なかよし'], ['music', '音あそび'], ['journal', '図鑑'], ['decor', '模様替え'], ['visitors', '訪問者']].map(([id, name]) => `<button data-play-tab="${id}" aria-pressed="${id === 'friends'}">${name}</button>`).join('')}</nav>
      <section data-play-panel="friends"><h3>ひと泳ぎずつ、顔なじみに。</h3><p>なでるモードで魚をつつくと、びっくりさせずに仲良くなれます。餌を食べた魚も少しずつ慣れてきます。</p><label class="play-check"><input id="gentle-mode" type="checkbox"> なでるモード</label><div class="friend-picker"><label for="friend-fish">気になる魚</label><select id="friend-fish"></select></div><div class="friend-card"><strong id="friend-caption"></strong><span id="friend-level"></span><progress id="friend-bond" max="100" value="0" aria-label="仲良し度"></progress><p id="friend-progress"></p><form id="friend-name-form"><label for="friend-name">お名前（16文字まで）</label><div><input id="friend-name" maxlength="16" autocomplete="off" placeholder="好きな名前を付けてね"><button type="submit">保存</button></div></form><div class="friend-actions"><button id="friend-feed">餌をひとつまみ</button><button id="friend-call">ここにおいで</button><button id="friend-watch">水槽で見る</button></div></div><p class="play-footnote">なでる仲良し度は2秒に1回。8で顔なじみ、24でなかよし、60でだいすき。呼ぶと仲良しの魚が10秒ほど寄ってきます。餌や敵にも気を配るので、毎回同じ動きにはなりません。</p></section>
      <section data-play-panel="music" hidden><h3>お魚たちと、小さな演奏会。</h3><p>お手本の順に魚をつつこう。同じ音の魚なら、どの子でもOK。時間制限はありません。まちがえても、最初から何度でも。</p><div id="phrase-list" class="play-card-list">${PHRASES.map((p, i) => `<article><div><h4>${p.name}</h4><p>${p.notes.map(n => NOTE_NAMES[n]).join(' · ')} <span id="song-done-${i}"></span></p></div><button data-start-phrase="${i}">遊ぶ ♪</button></article>`).join('')}</div><p class="play-footnote">数字は選んだBGMの音階。↑は高い音です。「遊ぶ」で音がオンになり、水槽に戻ります。完成すると魚たちがくるり。初めての完成で貝殻＋5。</p></section>
      <section data-play-panel="journal" hidden><h3>泳ぎ方の発見を、ひとつずつ。</h3><p id="journal-count"></p><div id="journal-list" class="journal-grid"></div><p class="play-footnote">新しい発見は貝殻＋4。水槽をリセットしても、このノートは残ります。</p></section>
      <section data-play-panel="decor" hidden><h3>貝殻で、わたしの水槽。</h3><p>背景・海藻・岩の色と、ドット絵の飾りを選べます。一度手に入れたものは何度でも使えます。</p><button id="decor-base" class="play-base">いつもの水槽に戻す</button><div id="decor-list" class="play-card-list"></div><p class="play-footnote">飾りは泳ぎを邪魔しません。位置は左・中央・右から選べます。</p></section>
      <section data-play-panel="visitors" hidden><h3>ときどき、小さなお客さま。</h3><p id="visitor-status"></p><div id="visitor-list" class="play-card-list"></div><p class="play-footnote">最初は水槽が動いている時間で約45秒後。その後は約2分半ごとに訪れ、90秒ほど滞在します。一時停止や別タブの時間は数えません。魚や画面の「会いにいく」ボタンをタップしてお迎えできます。</p></section>
      <p id="play-message" class="play-message" role="status"></p><p id="save-note" class="play-footnote">ノートはこのブラウザーに保存されます。</p></dialog>`);
    this.dialog = document.querySelector<HTMLDialogElement>('#play-notebook')!;
    document.querySelector<HTMLButtonElement>('#play-open')!.onclick = () => this.open('friends');
    document.querySelector<HTMLButtonElement>('#journal-open')!.onclick = () => this.open('journal');
    document.querySelector<HTMLButtonElement>('#play-close')!.onclick = () => { this.onClose(); this.dialog.close(); };
    this.dialog.addEventListener('cancel', () => this.onClose());
    this.dialog.addEventListener('close', () => { document.querySelector<HTMLCanvasElement>('#tank canvas')?.focus({ preventScroll: true }); });
    this.dialog.addEventListener('click', event => {
      const target = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!target) return;
      if (target.dataset.playTab) { this.tab = target.dataset.playTab; this.refresh(true); }
      if (target.dataset.startPhrase !== undefined) {
        this.game.startPhrase(+target.dataset.startPhrase); this.dialog.close(); this.onMusicStart(); this.updateHud(); this.onDemo(this.phraseIds());
      }
      if (target.dataset.buy) {
        if (this.game.buy(target.dataset.buy)) this.message('水槽に反映しました。'); this.refresh(true);
      }
    });
    document.querySelector<HTMLInputElement>('#gentle-mode')!.onchange = () => { this.game.toggleGentle(); this.refresh(true); };
    document.querySelector<HTMLSelectElement>('#friend-fish')!.onchange = event => { this.picked = +(event.target as HTMLSelectElement).value; this.updateFriend(); };
    document.querySelector<HTMLFormElement>('#friend-name-form')!.onsubmit = event => { event.preventDefault(); this.game.name(this.picked, document.querySelector<HTMLInputElement>('#friend-name')!.value); this.message('お名前を保存しました。'); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#friend-feed')!.onclick = () => { this.onFeed(); this.message('食べた魚の仲良し度が少し上がるよ。'); };
    document.querySelector<HTMLButtonElement>('#friend-call')!.onclick = () => { this.onCall(this.picked); this.dialog.close(); };
    document.querySelector<HTMLButtonElement>('#friend-watch')!.onclick = () => { this.sim.selected = this.picked; this.dialog.close(); };
    document.querySelector<HTMLButtonElement>('#decor-base')!.onclick = () => { this.game.baseLook(); this.refresh(true); };
    document.querySelector('#decor-list')!.addEventListener('change', event => {
      const input = event.target as HTMLInputElement | HTMLSelectElement, id = input.dataset.prop;
      if (!id) return;
      const on = this.dialog.querySelector<HTMLInputElement>(`input[data-prop="${id}"]`)!.checked;
      const position = +this.dialog.querySelector<HTMLSelectElement>(`select[data-prop="${id}"]`)!.value;
      this.game.prop(id, on, position); this.refresh(true);
    });
    document.querySelector<HTMLButtonElement>('#music-stop')!.onclick = () => { this.game.stopPhrase(); this.onClose(); this.updateHud(); };
    document.querySelector<HTMLButtonElement>('#music-replay')!.onclick = () => this.onDemo(this.phraseIds());
    document.querySelector<HTMLButtonElement>('#visitor-catch')!.onclick = () => { this.game.collectVisitor(); this.refresh(true); };
    this.refresh(true);
  }
  message(text: string) { document.querySelector('#play-message')!.textContent = text; }
  storageUnavailable() { document.querySelector('#save-note')!.textContent = 'この環境では保存できません。このページを開いている間は遊べます。'; }
  demo(active: boolean) { this.demonstrating = active; this.updateHud(); }
  open(tab: string) {
    this.tab = tab; if (this.sim.selected !== null) this.picked = this.sim.selected;
    this.message(''); this.refresh(true); if (!this.dialog.open) this.dialog.showModal();
  }
  private phraseIds() { return this.game.phrase ? PHRASES[this.game.phrase.index].notes.map(n => this.sim.fish.find(f => degreeOf(f.id) === n)?.id ?? n + 1) : []; }
  updateHud() {
    const p = this.game.phrase, hud = document.querySelector<HTMLElement>('#music-hud')!;
    hud.hidden = !p;
    if (!p) return;
    const phrase = PHRASES[p.index], ids = this.phraseIds();
    document.querySelector('#music-title')!.textContent = phrase.name;
    document.querySelector('#music-sequence')!.innerHTML = phrase.notes.map((n, i) => `<span class="${i < p.step ? 'done' : i === p.step ? 'next' : ''}">${NOTE_NAMES[n]}</span>`).join('');
    const target = this.sim.fish.find(f => degreeOf(f.id) === phrase.notes[p.step]);
    document.querySelector('#music-instruction')!.textContent = this.demonstrating ? 'お手本を演奏中 ♪ 終わったらつついてみよう。' : target ? `次は ${this.game.friend(target.id).name || `お魚 #${target.id}`}。光る輪が目印！ (${p.step}/${ids.length})` : 'この音の魚を増やしてね。';
  }
  refresh(force = false) {
    const state = this.game.state;
    document.querySelector('#play-shells')!.textContent = `◈ ${state.shells}`;
    document.querySelector('#notebook-shells')!.textContent = String(state.shells);
    document.querySelector('#play-summary')!.textContent = `発見 ${state.found.length}/${JOURNAL.length} · 演奏 ${state.songs.length}/${PHRASES.length} · 集めた貝殻 ${state.shells}`;
    const catchButton = document.querySelector<HTMLButtonElement>('#visitor-catch')!;
    catchButton.hidden = !this.game.visitor;
    if (this.game.visitor) catchButton.textContent = `${VISITORS[this.game.visitor.kind].name} · 会いにいく`;
    this.updateHud();
    if (!force && (!this.dialog.open || this.seenRevision === this.game.revision)) return;
    this.seenRevision = this.game.revision;
    document.querySelectorAll<HTMLButtonElement>('[data-play-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playTab === this.tab)));
    document.querySelectorAll<HTMLElement>('[data-play-panel]').forEach(p => p.hidden = p.dataset.playPanel !== this.tab);
    document.querySelector<HTMLInputElement>('#gentle-mode')!.checked = state.gentle;
    this.updateFriend();
    for (const i of [0, 1, 2]) document.querySelector(`#song-done-${i}`)!.textContent = state.songs.includes(i) ? '✓ 演奏できた' : '';
    document.querySelector('#journal-count')!.textContent = `${state.found.length} / ${JOURNAL.length} の発見`;
    document.querySelector('#journal-list')!.innerHTML = JOURNAL.map(j => `<article class="journal-entry ${state.found.includes(j.id) ? 'found' : ''}" data-discovery="${j.id}"><span>${state.found.includes(j.id) ? '✦' : '○'}</span><h4>${j.name}</h4><p>${j.hint}</p><small>${state.found.includes(j.id) ? '発見済み' : 'まだ見つけていない'}</small></article>`).join('');
    document.querySelector('#decor-list')!.innerHTML = SHOP.map(item => {
      const owned = state.owned.includes(item.id), prop = item.group === 'prop' ? state.props[item.id as 'shell' | 'arch' | 'star'] : null;
      const active = item.group === 'theme' ? state.theme === item.id : item.group === 'plant' ? state.plant === item.id : item.group === 'rock' ? state.rock === item.id : prop?.on;
      return `<article data-shop="${item.id}"><span class="decor-swatch" style="background:${item.swatch}"></span><div><h4>${item.name}</h4><p>${owned ? active ? '水槽に使っています' : '持っています' : `貝殻 ${item.cost} 個`}</p>${owned && item.group === 'prop' ? `<div class="prop-controls"><label><input type="checkbox" data-prop="${item.id}" ${prop?.on ? 'checked' : ''}> 飾る</label><select data-prop="${item.id}" aria-label="${item.name}の位置">${['左', '中央', '右'].map((name, i) => `<option value="${i}" ${prop?.position === i ? 'selected' : ''}>${name}</option>`).join('')}</select></div>` : ''}</div><button data-buy="${item.id}" ${!owned && state.shells < item.cost ? 'disabled' : ''}>${owned ? '使う' : '交換'}</button></article>`;
    }).join('');
    document.querySelector('#visitor-status')!.textContent = this.game.visitor ? `${VISITORS[this.game.visitor.kind].name}が滞在中。水槽に戻って会いにいこう！` : '今はお客さまを待っています。のんびり泳ぎを眺めよう。';
    document.querySelector('#visitor-list')!.innerHTML = (Object.keys(VISITORS) as VisitorKind[]).map(kind => `<article><div><h4>${VISITORS[kind].name}</h4><p>${VISITORS[kind].hint}</p><small>${state.visits[kind]} 回会えた · 貝殻＋${VISITORS[kind].reward}</small></div></article>`).join('');
  }
  private updateFriend() {
    const key = this.sim.fish.map(f => f.id).join('/');
    const select = document.querySelector<HTMLSelectElement>('#friend-fish')!;
    if (key !== this.fishKey) {
      this.fishKey = key; select.replaceChildren(...this.sim.fish.map(f => new Option('', String(f.id))));
      if (!this.sim.fish.some(f => f.id === this.picked)) this.picked = this.sim.fish[0]?.id ?? 1;
    }
    for (const o of select.options) { const f = this.sim.fish.find(f => f.id === +o.value)!; o.textContent = `${this.game.friend(f.id).name || `#${f.id}`} · ${FISH_PROFILES[f.species].name}`; }
    select.value = String(this.picked);
    const f = this.game.friend(this.picked), fish = this.sim.fish.find(f => f.id === this.picked);
    document.querySelector('#friend-caption')!.textContent = `${f.name || `お魚 #${this.picked}`} · ${fish ? FISH_PROFILES[fish.species].name : ''}`;
    document.querySelector('#friend-level')!.textContent = friendshipLabel(f.bond);
    document.querySelector<HTMLProgressElement>('#friend-bond')!.value = f.bond;
    document.querySelector('#friend-progress')!.textContent = `仲良し度 ${f.bond} / 100`;
    const input = document.querySelector<HTMLInputElement>('#friend-name')!;
    if (document.activeElement !== input) input.value = f.name;
    document.querySelector<HTMLButtonElement>('#friend-call')!.disabled = f.bond < 8;
  }
}
