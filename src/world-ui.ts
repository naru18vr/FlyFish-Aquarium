import { IdleAquarium, ROUTES } from './idle';
import { PERSONALITIES, PLACES, SHADES, stage, STAGES } from './idle-world';
import { FISH_PROFILES, FISH_SPECIES } from './species';
import type { AquariumGame } from './game';
import type { GameUI } from './game-ui';
import { portrait } from './idle-ui';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class WorldUI {
  onRoom = (_room: number) => {};
  private key = ''; private mailKey = ''; private colorKey = ''; private seen = -1;
  constructor(private idle: IdleAquarium, private game: AquariumGame, book: GameUI) {
    document.querySelector('.idle-diary')!.insertAdjacentHTML('beforebegin', `<div class="world-sections">
      <article><h4>🏝️ わたしの水槽たち</h4><p>Lv.2で夕焼けの浅瀬、Lv.3で星夜の水槽が増えます。最初の水槽には元からのお魚、どの水槽にも育てたお魚を引っ越せます。</p><div id="world-rooms" class="world-room-buttons"></div><form id="world-room-name"><label for="world-room-title">この水槽の名前</label><input id="world-room-title" maxlength="16"><button>名前を保存</button></form><p>「模様替え」の背景・海藻・飾りは水槽ごとに保存。育てたお魚の「引っ越し」で住む水槽を選べます。</p></article>
      <article><h4>🦀 カニのお店番</h4><p>留守中にもカニが貝殻を拾います。15分ごとにあいさつして仲良くなると、お手伝いが増えます。</p><p id="world-crab-status"></p><button id="world-crab-greet">カニにあいさつ</button><button id="world-crab-collect">お店番の貝殻を受け取る</button></article>
      <article><h4>🗺️ お魚たちの探検地図</h4><p>浅瀬と星砂の探検のお土産を受け取ると珊瑚の迷路、珊瑚の探検でオーロラの海が見つかります。</p><ol id="world-map"></ol><p>珊瑚は6時間・仲良し度60・Lv.3、オーロラは8時間・仲良し度60・Lv.4。上の「お魚のおでかけ」で選べます。</p></article>
      <article><h4>♡ お気に入りの場所</h4><p>同じ水槽で過ごすと、海藻や飾りが好きになります。ときどきそばへ寄ってひと休みします。餌や敵、マウスを優先します。</p><ul id="world-favorites"></ul></article>
    </div><article class="world-children"><h4>🐟 育てたお魚</h4><p>孵化から1時間で少し大きく、4時間で大人に。名前を付けたり引っ越したりできます。お世話できない日も弱りません。</p><div id="world-children"></div><h5>おやすみホテル</h5><p>大人のお魚をホテルで休ませると、新しい卵を迎える場所が空きます。名前と色を保存し、空きがあれば水槽へ戻せます。ホテルは200匹まで。</p><label for="world-hotel-fish">休んでいるお魚</label><select id="world-hotel-fish"></select><button id="world-hotel-return">水槽へ戻す</button></article>
    <article class="world-colors"><h4>✨ 色違いのお魚図鑑</h4><p>ときどき真珠・夕焼け・ミント色のお魚が生まれます。見つけた色はずっと記録されます。</p><p id="world-color-count"></p><div id="world-color-book"></div></article>
    <article class="world-mail"><h4>💌 水槽からのお便り</h4><p>成長やお気に入りの場所、留守中の思い出を名前付きの絵はがきに。お便りは最新30通を保存します。</p><button id="world-mail-read">お便りを読んだよ</button><div id="world-mail"></div></article>`);
    document.querySelector('#tank')!.insertAdjacentHTML('beforeend', '<button id="world-room-open" class="world-room-open">水槽たち →</button>');
    document.querySelector<HTMLButtonElement>('#world-room-open')!.onclick = () => { book.open('idle'); document.querySelector('#world-rooms')!.scrollIntoView({ block: 'center' }); this.refresh(true); };
    const routeSelect = document.querySelector<HTMLSelectElement>('#idle-trip-route')!;
    ROUTES.slice(2).forEach((r, i) => routeSelect.add(new Option(`${r.name} · ${r.seconds / 3600}時間 · 貝殻${r.shells}個`, String(i + 2))));
    document.querySelector('#world-rooms')!.addEventListener('click', event => { const b = (event.target as Element).closest<HTMLButtonElement>('[data-room]'); if (b) { this.onRoom(+b.dataset.room!); this.refresh(true); } });
    document.querySelector<HTMLFormElement>('#world-room-name')!.onsubmit = event => { event.preventDefault(); idle.nameRoom(idle.state.world.room, document.querySelector<HTMLInputElement>('#world-room-title')!.value); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#world-crab-greet')!.onclick = () => { idle.greetCrab(); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#world-crab-collect')!.onclick = () => { idle.collectCrab(); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#world-mail-read')!.onclick = () => { idle.readLetters(); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#world-hotel-return')!.onclick = () => { idle.restoreChild(+document.querySelector<HTMLSelectElement>('#world-hotel-fish')!.value); this.refresh(true); };
    document.querySelector('#world-children')!.addEventListener('click', event => { const b = (event.target as Element).closest<HTMLButtonElement>('[data-child-hotel]'); if (b) { idle.hotelChild(+b.dataset.childHotel!); this.refresh(true); } });
    document.querySelector('#world-children')!.addEventListener('submit', event => { event.preventDefault(); const form = event.target as HTMLFormElement; idle.nameChild(+form.dataset.childName!, form.querySelector<HTMLInputElement>('input')!.value); this.refresh(true); });
    document.querySelector('#world-children')!.addEventListener('change', event => { const input = event.target as HTMLSelectElement; if (input.dataset.childRoom) { idle.moveChild(+input.dataset.childRoom, +input.value); this.refresh(true); } });
    document.querySelector('#play-notebook')!.addEventListener('click', () => this.refresh(true));
    this.refresh(true);
  }
  refresh(force = false) {
    const s = this.idle.state, w = s.world;
    const quick = document.querySelector<HTMLButtonElement>('#world-room-open')!;
    quick.hidden = !!this.game.phrase; quick.textContent = `${w.rooms[w.room].name} · ${w.letters.filter(l => l.id > w.read).length ? 'お便りあり' : '水槽たち'} →`;
    for (const o of document.querySelector<HTMLSelectElement>('#idle-trip-route')!.options) o.disabled = !this.idle.routeAvailable(+o.value);
    if (!force && (document.querySelector<HTMLElement>('[data-play-panel="idle"]')!.hidden || this.seen === this.idle.revision)) return;
    this.seen = this.idle.revision;
    document.querySelector('#world-rooms')!.innerHTML = w.rooms.map((r, i) => `<button data-room="${i}" aria-pressed="${i === w.room}" ${i >= s.level ? 'disabled' : ''}>${esc(r.name)} ${i === w.room ? '✓ 表示中' : i >= s.level ? `· Lv.${i + 1}で解放` : 'へ移動'}</button>`).join('');
    const title = document.querySelector<HTMLInputElement>('#world-room-title')!; if (document.activeElement !== title) title.value = w.rooms[w.room].name;
    const rate = w.crab.bond >= 15 ? 6 : w.crab.bond >= 5 ? 4 : 2;
    document.querySelector('#world-crab-status')!.textContent = `仲良し度 ${w.crab.bond}/30 · 1時間に${rate}個 · お預かり ${w.crab.pending}/100個。${w.crab.bond < 5 ? '5で1時間に4個' : w.crab.bond < 15 ? '15で1時間に6個' : '頼れるお店番！'}`;
    const greet = document.querySelector<HTMLButtonElement>('#world-crab-greet')!; greet.disabled = s.total < w.crab.nextGreeting || w.crab.bond >= 30; greet.textContent = s.total < w.crab.nextGreeting ? `あいさつまであと${Math.ceil((w.crab.nextGreeting - s.total) / 60)}分` : 'カニにあいさつ';
    document.querySelector<HTMLButtonElement>('#world-crab-collect')!.disabled = !w.crab.pending;
    document.querySelector('#world-map')!.innerHTML = ROUTES.map((r, i) => `<li class="${w.map[i] ? 'found' : ''}"><strong>${i + 1}. ${r.name}</strong><span>${w.map[i] ? `✓ 探検${w.map[i]}回` : this.idle.routeAvailable(i) ? '探検できます' : 'まだ見つかっていません'}</span></li>`).join('');
    document.querySelector('#world-favorites')!.innerHTML = Object.entries(w.favorites).slice(0, 6).map(([id, f]) => `<li>${esc(this.game.friend(+id).name || `お魚 #${id}`)} · ${PLACES[f.place]} · なじみ度${Math.floor(f.affection)}</li>`).join('') || '<li>まずは10分ほど一緒に過ごそう。思い出はお便りにも届きます。</li>';
    const key = JSON.stringify([s.level, w.rooms.map(r => r.name), s.young.map(f => [f.id, w.children[f.id]?.name, w.children[f.id]?.room, w.children[f.id]?.stage, w.children[f.id]?.shade])]);
    if (key !== this.key) {
      this.key = key;
      document.querySelector('#world-children')!.innerHTML = s.young.map(f => { const c = w.children[f.id]; if (!c) return ''; return `<div class="world-child">${portrait(f.species, c.name, c.room === 2, c.shade)}<strong>${esc(c.name)} · ${FISH_PROFILES[f.species].name}</strong><p>${STAGES[stage(s.total - f.born)]} · ${SHADES[c.shade]} · ${PERSONALITIES[c.personality]}</p><p>お気に入り：${PLACES[c.favorite]}</p><progress id="child-growth-${f.id}" max="14400" value="${Math.min(14400, s.total - f.born)}" aria-label="${esc(c.name)}の成長"></progress><form data-child-name="${f.id}"><label>お名前<input maxlength="16" value="${esc(c.name)}"></label><button>保存</button></form><label>引っ越し<select data-child-room="${f.id}">${w.rooms.map((r, i) => `<option value="${i}" ${i === c.room ? 'selected' : ''} ${i >= s.level ? 'disabled' : ''}>${esc(r.name)}</option>`).join('')}</select></label><button data-child-hotel="${f.id}" ${c.stage < 2 || w.hotel.length >= 200 ? 'disabled' : ''}>ホテルで休む</button></div>`; }).join('') || '<p>卵が孵ると、ここに小さなお魚が並びます。</p>';
    }
    for (const f of s.young) { const p = document.querySelector<HTMLProgressElement>(`#child-growth-${f.id}`); if (p) p.value = Math.min(14400, s.total - f.born); }
    document.querySelector('#world-color-count')!.textContent = `${w.colors.length} / 20 種類を発見`;
    const colorKey = JSON.stringify(w.colors);
    if (this.colorKey !== colorKey) { this.colorKey = colorKey; document.querySelector('#world-color-book')!.innerHTML = FISH_SPECIES.flatMap(f => SHADES.map((shade, i) => `<div class="${w.colors.includes(`${f}:${i}`) ? 'found' : ''}">${w.colors.includes(`${f}:${i}`) ? portrait(f, FISH_PROFILES[f].name, false, i) : '？'}<small>${FISH_PROFILES[f].name}<br>${shade}</small></div>`)).join(''); }
    const hotel = document.querySelector<HTMLSelectElement>('#world-hotel-fish')!;
    const hotelNames = w.hotel.map(h => h.child.name);
    if (hotel.options.length !== hotelNames.length || hotelNames.some((name, i) => hotel.options[i].text !== name)) hotel.replaceChildren(...w.hotel.map(h => new Option(h.child.name, String(h.fish.id))));
    document.querySelector<HTMLButtonElement>('#world-hotel-return')!.disabled = !w.hotel.length || s.young.length + s.eggs.length >= 12;
    const mailKey = JSON.stringify([w.letters, w.read]);
    if (mailKey !== this.mailKey) { this.mailKey = mailKey; document.querySelector('#world-mail')!.innerHTML = [...w.letters].reverse().map(l => `<div class="world-letter">${portrait(l.species, l.name, l.room === 2, l.shade)}<strong>${l.id > w.read ? '✦ 新しいお便り · ' : ''}${esc(l.name)}より</strong><p>${esc(l.text)}</p><small>${new Date(l.at).toLocaleString('ja-JP')} · ${esc(w.rooms[l.room].name)}</small></div>`).join('') || '<p>最初のお便りは30分ほどで届きます。</p>'; }
  }
}
