import { GARDENS, IdleAquarium, ROUTES } from './idle';
import type { AquariumGame } from './game';
import type { Aquarium } from './simulation';
import type { GameUI } from './game-ui';
import { FISH_PROFILES, type FishSpecies } from './species';

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function portrait(species: FishSpecies, name: string, night: boolean, shade = 0) {
  const pattern = FISH_PROFILES[species].pattern, width = Math.max(...pattern.map(row => row.length));
  const colors: Record<string, string> = { a: ['#bf8653', '#a6a3c1', '#c87689', '#5a9e90'][shade], b: ['#efb969', '#d4d1ef', '#f6b1bd', '#9ed8bd'][shade], c: '#ffe5aa', d: '#fff9df', w: '#fffce7', e: '#173c3d' };
  const pixels = pattern.flatMap((row, y) => [...row].flatMap((p, x) => colors[p] ? [`<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[p]}"/>`] : [])).join('');
  return `<svg viewBox="0 0 40 30" role="img" aria-label="${escape(name)}の探検写真" shape-rendering="crispEdges"><rect width="40" height="30" fill="${night ? '#394971' : '#47928e'}"/><rect y="25" width="40" height="5" fill="#a1b98c"/><rect x="4" y="19" width="2" height="7" fill="#80b890"/><rect x="31" y="17" width="2" height="9" fill="#80b890"/>${night ? '<rect x="7" y="5" width="2" height="2" fill="#f3dcaa"/><rect x="32" y="8" width="1" height="1" fill="#f3dcaa"/>' : '<rect x="3" y="4" width="2" height="2" fill="#b9e8cf"/>'}<g transform="translate(${(40 - width) / 2},${(25 - pattern.length) / 2})">${pixels}</g></svg>`;
}
const duration = (seconds: number) => { const minutes=Math.ceil(seconds/60); return seconds<=0?'できた！':minutes<60?`あと${Math.max(1,minutes)}分`:`あと${Math.floor(minutes/60)}時間${minutes%60?`${minutes%60}分`:''}`; };

export class IdleUI {
  private seen = -1;
  private picked = 1;
  private photoKey = '';
  private root: HTMLElement;
  constructor(private idle: IdleAquarium, private game: AquariumGame, private sim: Aquarium, private book: GameUI) {
    document.querySelector('.play-tabs')!.insertAdjacentHTML('beforeend', '<button data-play-tab="idle" aria-pressed="false">おるすばん</button>');
    document.querySelector('.play-menu')!.insertAdjacentHTML('beforeend', '<button data-play-route="idle"><span aria-hidden="true">⌂</span><strong>おるすばんの水槽</strong><small>貝殻・お花・探検・卵・留守中の日記</small><b aria-hidden="true">→</b></button>');
    document.querySelector('#play-message')!.insertAdjacentHTML('beforebegin', `<section data-play-panel="idle" hidden>
      <h3>待つ → 受け取る → 水槽を育てる</h3><p>閉じても1回最大8時間ぶん育ちます。魚は死にません。貝殻を受け取って、お魚と水槽を育てよう。</p>
      <section id="idle-overview" class="idle-overview" aria-label="放置の成果と次の目標">
        <div class="idle-reward-heading"><div><span>いま受け取れる成果</span><strong id="idle-reward-total"></strong></div><button id="idle-claim-all">成果をまとめて受け取る</button></div>
        <p id="idle-reward-detail"></p>
        <div class="idle-summary-grid"><article><h4>🥚 次に育つもの</h4><strong id="idle-next-growth"></strong><p id="idle-next-flower"></p></article><article><h4>🏡 次の目標</h4><strong id="idle-goal"></strong><p id="idle-goal-detail"></p></article></div>
        <p id="idle-next-action" role="status"></p><div class="idle-actions"><button id="idle-go-journal">図鑑のヒントを見る →</button><button id="idle-go-shop">貝殻で模様替え →</button></div>
        <p class="play-footnote">受け取った貝殻は右上のお財布へ。飾りを集めて、魚の成長や新しい水槽を楽しもう。受け取り待ちでも育成は続きます。</p>
      </section><div id="idle-welcome" class="play-help" hidden><strong>おかえりなさい！</strong><p id="idle-welcome-text"></p><button id="idle-dismiss">おかえりの案内を閉じる</button></div>
      <div class="idle-sections">
        <article><h4>🐚 貝殻ひろい</h4><p>5分に1個。200個まで貯まります。</p><strong id="idle-shell-count"></strong><button id="idle-shell-collect">まとめて受け取る</button></article>
        <article><h4>🌱 海藻ガーデン</h4><label for="idle-garden-kind">育てる海藻</label><select id="idle-garden-kind"></select><progress id="idle-garden-progress" max="1200" value="0" aria-label="海藻の成長"></progress><p id="idle-garden-status"></p><button id="idle-harvest">お花を収穫する</button><p class="play-footnote">20分で開花。収穫で貝殻＋6、初回は桃色の海藻、3回目はすみれ色の岩が使えるようになります。</p></article>
        <article><h4>🐟 お魚のおでかけ</h4><p>仲良しの魚を1匹、探検へ。帰るまで水槽を離れます。</p><div id="idle-trip-picker"><label for="idle-trip-fish">探検する魚</label><select id="idle-trip-fish"></select><label for="idle-trip-route">行き先</label><select id="idle-trip-route"><option value="0">浅瀬のおさんぽ · 1時間 · 貝殻12個</option><option value="1">星砂の入り江 · 3時間 · 貝殻30個</option></select><p id="idle-trip-help"></p><button id="idle-trip-start">探検に出発する</button></div><div id="idle-trip-active" hidden><p id="idle-trip-status"></p><progress id="idle-trip-progress" max="3600" value="0" aria-label="探検の進み具合"></progress><button id="idle-trip-receive">お土産と写真を受け取る</button></div><p id="idle-souvenirs"></p><div id="idle-photos" class="idle-photos"></div></article>
        <article><h4>🥚 卵と稚魚</h4><p>最初の卵は20分ほどで見つかり、その後は約2時間ごと。卵は30分で孵ります。</p><div id="idle-nursery"></div><p class="play-footnote">育てた魚と卵は、すべての水槽で合計12匹まで。魚の名前・引っ越し・ホテルは下の「育てたお魚」で操作します。</p></article>
        <article><h4>🏡 水槽の成長</h4><strong id="idle-level"></strong><progress id="idle-level-progress" max="600" value="0" aria-label="水槽の成長"></progress><p id="idle-level-next"></p><ul><li>Lv.2：10分 ＋ 図鑑5項目 → 夕焼け・桃色のお花</li><li>Lv.3：1時間 ＋ 図鑑7項目 → 星夜・星の海藻・貝の妖精・新しい探検</li><li>Lv.4：4時間 ＋ 図鑑10項目 → アーチ・おほしさま</li></ul><p class="play-footnote">解放した飾りは「模様替え」で無料で使えます。見つけ方のヒントは「図鑑」にあります。</p><button id="idle-fairy">貝の妖精をお迎えする · 貝殻＋6</button></article>
        <article><h4>🍽️ 自動ごはん</h4><label class="play-check"><input id="idle-auto-feed" type="checkbox" checked> 45秒ごとに餌をあげる</label><p>水槽が動いている間に自動で給餌。手であげた餌を食べると仲良し度＋2、自動の餌は＋1です。</p><p class="play-footnote">餌場からの自動給餌は、水槽設定の「餌場の数」で調整できます。</p></article>
      </div><article class="idle-diary"><h4>📔 留守中の思い出</h4><p>留守中の出来事をまとめた小さな日記です。</p><ol id="idle-diary-list"></ol></article>
    </section>`);
    this.root = document.querySelector('[data-play-panel="idle"]')!;
    document.querySelector('#tank')!.insertAdjacentHTML('beforeend', '<button id="idle-open" class="idle-open" aria-haspopup="dialog">おるすばん →</button><button id="idle-fairy-visit" class="idle-fairy-visit" hidden>✦ 貝の妖精が来たよ</button>');
    document.querySelector<HTMLButtonElement>('#idle-open')!.onclick = () => { book.open('idle'); this.refresh(true); };
    document.querySelector<HTMLButtonElement>('#idle-fairy-visit')!.onclick = () => { book.open('idle'); this.refresh(true); };
    for (const [id, action] of [
      ['idle-shell-collect', () => { const n=idle.state.shells; if(idle.collectShells())book.message(`貝殻${n}個を受け取りました。右上の持っている貝殻に加わりました。`); }], ['idle-harvest', () => idle.harvest()],
      ['idle-trip-receive', () => idle.receiveJourney()], ['idle-fairy', () => idle.greetFairy()],
      ['idle-dismiss', () => idle.dismissWelcome()],
      ['idle-claim-all', () => { const n=idle.claimAll(); if(n)book.message(`貝殻${n}個をまとめて受け取りました。収穫した海藻はまた育ち始めます。`); }],
      ['idle-go-journal', () => book.open('journal')], ['idle-go-shop', () => book.open('decor')],
    ] as const) document.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => { action(); this.refresh(true); };
    document.querySelector<HTMLInputElement>('#idle-auto-feed')!.onchange = () => { idle.toggleFeed(); this.refresh(true); };
    document.querySelector<HTMLSelectElement>('#idle-garden-kind')!.onchange = event => { idle.garden(+(event.target as HTMLSelectElement).value); this.refresh(true); };
    document.querySelector<HTMLSelectElement>('#idle-trip-fish')!.onchange = event => { this.picked = +(event.target as HTMLSelectElement).value; this.refresh(true); };
    document.querySelector<HTMLSelectElement>('#idle-trip-route')!.onchange = () => this.refresh(true);
    document.querySelector<HTMLButtonElement>('#idle-trip-start')!.onclick = () => {
      const fish = sim.fish.find(f => f.id === this.picked); if (!fish) return;
      const friend = game.friend(fish.id), route = +document.querySelector<HTMLSelectElement>('#idle-trip-route')!.value;
      idle.startJourney(fish, friend.name || `お魚 #${fish.id}`, friend.bond, route); if (idle.isAway(fish.id) && sim.selected === fish.id) sim.selected = null;
      this.refresh(true);
    };
    document.querySelector('#play-notebook')!.addEventListener('click', () => this.refresh(true));
    this.refresh(true);
  }
  refresh(force = false) {
    const s = this.idle.state;
    const quick = document.querySelector<HTMLButtonElement>('#idle-open')!;
    quick.hidden = !!this.game.phrase; quick.textContent = `おるすばん${this.idle.rewards.shells ? ' · 貝殻' + this.idle.rewards.shells + '個' : ' · 育成中'} →`;
    document.querySelector<HTMLButtonElement>('#idle-fairy-visit')!.hidden = !s.fairy || !!this.game.phrase;
    if (!force && (this.root.hidden || this.seen === this.idle.revision)) return;
    this.seen = this.idle.revision;
    const set = (id: string, value: string) => document.querySelector(`#${id}`)!.textContent = value;
    const button = (id: string, disabled: boolean) => document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = disabled;
    const rewards = this.idle.rewards;
    set('idle-reward-total', `貝殻 ${rewards.shells} 個`);
    set('idle-reward-detail', rewards.entries.length ? rewards.entries.map(e => `${e.name} ＋${e.amount}`).join(' ・ ') : '成果は自動で貯まります。最初の貝殻は5分、お花は20分で受け取れます。');
    button('idle-claim-all', rewards.shells === 0);
    document.querySelector('#idle-claim-all')!.textContent = rewards.shells ? `貝殻${rewards.shells}個をまとめて受け取る` : '成果が貯まるのを待っています';
    const egg = s.eggs.reduce<number | null>((soonest, e) => Math.min(soonest ?? Infinity, Math.max(0, 1800 - (s.total - e.born))), null);
    set('idle-next-growth', egg !== null ? `卵が孵るまで ${duration(egg)}` : s.young.length + s.eggs.length >= 12 ? '育成枠がいっぱい（12匹）' : `次の卵 ${duration(s.nextEgg - s.total)}`);
    set('idle-next-flower', s.growth >= 1200 ? 'お花も収穫できます！' : `お花の開花 ${duration(1200 - s.growth)} · 育てた魚${s.young.length}匹`);
    const goalTime = [0,600,3600,14400][s.level] ?? 14400, goalDiscoveries = [0,5,7,10][s.level] ?? 10;
    set('idle-goal', s.level === 4 ? 'Lv.4 · 成長特典をすべて解放！' : `水槽 Lv.${s.level} → Lv.${s.level + 1}`);
    set('idle-goal-detail', s.level === 4 ? '色違い・探検地図・お気に入りの水槽を集めよう。' : `${s.total >= goalTime ? '時間 ✓' : '育成時間 ' + duration(goalTime - s.total)} ／ 図鑑 ${Math.min(s.discoveries,goalDiscoveries)}/${goalDiscoveries}${s.discoveries >= goalDiscoveries ? ' ✓' : '（あと' + (goalDiscoveries-s.discoveries) + '項目）'}。両方そろうと成長します。`);
    set('idle-next-action', rewards.shells ? '今できること：成果を受け取って、模様替えを楽しもう。' : s.level < 4 && s.discoveries < goalDiscoveries ? '今できること：図鑑のヒントを見て、魚と遊んでみよう。待ち時間も育成が進みます。' : '今できること：魚を眺めたり、音で遊んだりして待とう。閉じても最大8時間ぶん進みます。');
    document.querySelector<HTMLElement>('#idle-welcome')!.hidden = !s.welcome;
    if (s.welcome) set('idle-welcome-text', `${Math.max(1, Math.floor(s.welcome.seconds / 60))}分ぶんの思い出。貝殻＋${s.welcome.shells}、生まれた稚魚${s.welcome.hatched}匹。成果を下のボタンから受け取ろう。`);
    set('idle-shell-count', `${s.shells} / 200 個`); document.querySelector('#idle-shell-collect')!.textContent=s.shells?`貝殻${s.shells}個を受け取る`:'貝殻は5分ごとに貯まります'; button('idle-shell-collect', s.shells === 0);
    const gardens = document.querySelector<HTMLSelectElement>('#idle-garden-kind')!;
    if (gardens.options.length !== Math.min(3, s.level)) gardens.replaceChildren(...GARDENS.slice(0, Math.min(3, s.level)).map((name, i) => new Option(name, String(i))));
    gardens.value = String(s.garden);
    document.querySelector<HTMLProgressElement>('#idle-garden-progress')!.value = s.growth;
    set('idle-garden-status', s.growth >= 1200 ? 'お花が咲いた！ いつでも収穫できます。' : `収穫${duration(1200 - s.growth)} · ${s.blooms}回収穫`); button('idle-harvest', s.growth < 1200);
    const select = document.querySelector<HTMLSelectElement>('#idle-trip-fish')!;
    const fish = this.sim.fish;
    if (!fish.some(f => f.id === this.picked)) this.picked = fish[0]?.id ?? 1;
    const options = fish.map(f => ({ value: String(f.id), name: `${this.game.friend(f.id).name || `お魚 #${f.id}`} · 仲良し度${this.game.friend(f.id).bond}` }));
    if (select.options.length !== options.length || options.some((o, i) => select.options[i]?.textContent !== o.name)) select.replaceChildren(...options.map(o => new Option(o.name, o.value)));
    select.value = String(this.picked);
    const route = +document.querySelector<HTMLSelectElement>('#idle-trip-route')!.value, r = ROUTES[route];
    const bond = this.game.friend(this.picked).bond, locked = !this.idle.routeAvailable(route);
    set('idle-trip-help', locked ? `水槽Lv.${r.level}と探検地図の条件が必要です。下の「探検地図」を見てね。` : bond < r.bond ? `仲良し度があと${r.bond - bond}必要です。「なかよし」でなでるか、餌をあげよう。` : '準備できたよ。帰ったら水槽に戻り、お土産と写真を持ってきます。');
    button('idle-trip-start', locked || bond < r.bond || !fish.length);
    document.querySelector<HTMLElement>('#idle-trip-picker')!.hidden = !!s.journey;
    document.querySelector<HTMLElement>('#idle-trip-active')!.hidden = !s.journey;
    if (s.journey) {
      const j = s.journey, r = ROUTES[j.route];
      set('idle-trip-status', `${j.name || 'お魚'} · ${r.name} · ${j.elapsed >= r.seconds ? 'おかえり！ お土産が届いています。' : duration(r.seconds - j.elapsed)}`);
      const progress = document.querySelector<HTMLProgressElement>('#idle-trip-progress')!; progress.max = r.seconds; progress.value = j.elapsed;
      button('idle-trip-receive', j.elapsed < r.seconds);
    }
    set('idle-souvenirs', s.souvenirs.length ? `お土産：${s.souvenirs.join('・')} · ${s.trips}回の探検` : 'お土産と写真は、探検から帰ると集められます。');
    const photoKey = JSON.stringify(s.photos);
    if (photoKey !== this.photoKey) {
      this.photoKey = photoKey;
      document.querySelector('#idle-photos')!.innerHTML = s.photos.slice(-6).map(p => `<div>${portrait(p.species, p.name, p.place === ROUTES[1].name)}<strong>${escape(p.name)}</strong><small>${escape(p.place)} · ${FISH_PROFILES[p.species].name}</small></div>`).join('');
    }
    document.querySelector('#idle-nursery')!.innerHTML = `${s.eggs.map(e => `<p>🥚 ${FISH_PROFILES[e.species].name}の卵 · 孵化${duration(1800 - (s.total - e.born))}</p>`).join('')}<p>育てているお魚：${s.young.length}匹</p>${s.young.length ? `<div class="idle-young-list">${s.young.map(f => `<span>🐟 ${FISH_PROFILES[f.species].name}</span>`).join('')}</div>` : s.eggs.length ? '' : `<p>次の卵${duration(s.nextEgg - s.total)}。のんびり待とう。</p>`}`;
    set('idle-level', `水槽 Lv.${s.level} · 図鑑 ${s.discoveries}/14`);
    const needed=[0,5,7,10][s.level]??10;
    const thresholds = [0, 600, 3600, 14400], next = thresholds[s.level] ?? 14400;
    const levelProgress = document.querySelector<HTMLProgressElement>('#idle-level-progress')!; levelProgress.max = next; levelProgress.value = Math.min(next, s.total);
    set('idle-level-next', s.level === 4 ? 'すべての成長特典を解放しました！' : `Lv.${s.level+1}への条件：${s.total>=next?'時間は達成':duration(next-s.total)} · 図鑑${Math.min(s.discoveries,needed)}/${needed}項目${s.discoveries>=needed?'（達成）':`（あと${needed-s.discoveries}項目）`}。両方そろうと解放されます。`);
    button('idle-fairy', !s.fairy); document.querySelector('#idle-fairy')!.textContent=s.fairy?'貝の妖精をお迎えする · 貝殻＋6':s.level<3?'貝の妖精はLv.3で会えるよ':'貝の妖精を待っています'; document.querySelector<HTMLInputElement>('#idle-auto-feed')!.checked = s.autoFeed;
    document.querySelector('#idle-diary-list')!.innerHTML = s.diary.length ? [...s.diary].reverse().slice(0, 20).map(d => `<li><time>${new Date(d.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span>${escape(d.text)}</span></li>`).join('') : '<li>思い出はこれから。水槽が育つと、日記が届きます。</li>';
  }
}
