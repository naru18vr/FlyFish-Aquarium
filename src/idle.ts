import { FISH_SPECIES, type FishSpecies } from './species';
import type { ShopId } from './game';
import { addLetter, advanceWorld, readWorld, type Look, type WorldContext, type WorldState } from './idle-world';

export const IDLE_KEY = 'flyfish-idle-v1';
export const OFFLINE_CAP = 8 * 3600;
export const GARDENS = ['みどりの海藻', '桃色のお花', '星の海藻'] as const;
export const ROUTES = [
  { name: '浅瀬のおさんぽ', seconds: 3600, shells: 12, bond: 8, level: 1 },
  { name: '星砂の入り江', seconds: 10800, shells: 30, bond: 24, level: 3 },
  { name: '珊瑚の迷路', seconds: 21600, shells: 50, bond: 60, level: 3 },
  { name: 'オーロラの海', seconds: 28800, shells: 80, bond: 60, level: 4 },
] as const;
const SOUVENIRS = ['真珠のかけら', '珊瑚のかけら', '星砂の小瓶'] as const;
export interface YoungFish { id: number; species: FishSpecies; born: number }
interface Journey { fishId: number; name: string; species: FishSpecies; route: number; elapsed: number; recorded: boolean }
interface Grant { id: string; shells: number; items: ShopId[] }
export interface IdleState {
  version: 1; epoch: string; lastSeen: number; total: number; shells: number; shellRemainder: number;
  garden: number; growth: number; blooms: number; level: number; discoveries: number;
  journey: Journey | null; trips: number; souvenirs: string[];
  photos: { species: FishSpecies; name: string; place: string }[];
  eggs: YoungFish[]; young: YoungFish[]; nextEgg: number; serial: number;
  fairy: boolean; fairyRemainder: number; autoFeed: boolean;
  diary: { id: number; at: number; text: string }[];
  welcome: { seconds: number; shells: number; hatched: number } | null;
  grants: Grant[];
  world: WorldState;
}
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const num = (v: unknown, fallback: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const int = (v: unknown, fallback: number, max: number) => Math.floor(num(v, fallback, max));
const species = (v: unknown): FishSpecies => FISH_SPECIES.includes(v as FishSpecies) ? v as FishSpecies : 'goldfish';
const text = (v: unknown, fallback = '') => typeof v === 'string' ? v.slice(0, 120) : fallback;
export function readIdleState(raw: unknown, now: number): IdleState {
  const s = obj(raw);
  const state: IdleState = { version: 1, epoch: now.toString(36) + Math.random().toString(36).slice(2, 8), lastSeen: now, total: 0, shells: 0, shellRemainder: 0, garden: 0, growth: 0, blooms: 0, level: 1, discoveries: 0,
    journey: null, trips: 0, souvenirs: [], photos: [], eggs: [], young: [], nextEgg: 1200, serial: 0, fairy: false, fairyRemainder: 0, autoFeed: true, diary: [], welcome: null, grants: [], world: readWorld(null, 0, now) };
  if (s.version !== 1) return state;
  if (typeof s.epoch === 'string' && /^[a-z0-9]{6,30}$/.test(s.epoch)) state.epoch = s.epoch;
  state.lastSeen = num(s.lastSeen, now, now); if (state.lastSeen <= 0) state.lastSeen = now;
  state.total = num(s.total, 0, 1e9); state.shells = int(s.shells, 0, 200); state.shellRemainder = num(s.shellRemainder, 0, 299.999);
  state.growth = num(s.growth, 0, 1200); state.blooms = int(s.blooms, 0, 99999); state.level = Math.max(1, int(s.level, 1, 4));
  state.garden = int(s.garden, 0, Math.min(2, state.level - 1)); state.discoveries = int(s.discoveries, 0, 14);
  state.trips = int(s.trips, 0, 99999); state.serial = int(s.serial, 0, 1e9); state.autoFeed = s.autoFeed !== false;
  state.fairy = s.fairy === true && state.level >= 3; state.fairyRemainder = num(s.fairyRemainder, 0, 1799.999);
  state.nextEgg = Math.max(state.total, num(s.nextEgg, state.total + 1200, 1e9 + 7200));
  const young = (v: unknown, limit: number) => Array.isArray(v) ? v.slice(0, limit).map(raw => { const a = obj(raw); return { id: int(a.id, 0, 1e9), species: species(a.species), born: num(a.born, state.total, state.total) }; }).filter(a => a.id > 0) : [];
  state.young = young(s.young, 12); state.eggs = young(s.eggs, 3);
  const seen = new Set<number>();
  state.young = state.young.filter(a => !seen.has(a.id) && !!seen.add(a.id)); state.eggs = state.eggs.filter(a => !seen.has(a.id) && !!seen.add(a.id));
  state.serial = Math.max(state.serial, ...seen);
  if (s.journey && typeof s.journey === 'object') {
    const j = obj(s.journey), route = int(j.route, 0, 3), fishId = int(j.fishId, 0, 999999999);
    if (fishId > 0) state.journey = { fishId, name: text(j.name).slice(0, 16), species: species(j.species), route, elapsed: num(j.elapsed, 0, ROUTES[route].seconds), recorded: j.recorded === true };
  }
  state.souvenirs = Array.isArray(s.souvenirs) ? [...new Set(s.souvenirs.filter((v): v is string => SOUVENIRS.includes(v as typeof SOUVENIRS[number])))] : [];
  state.photos = Array.isArray(s.photos) ? s.photos.slice(-12).map(raw => { const p = obj(raw); return { species: species(p.species), name: text(p.name).slice(0, 16), place: text(p.place).slice(0, 30) }; }) : [];
  state.diary = Array.isArray(s.diary) ? s.diary.slice(-30).map(raw => { const a = obj(raw); return { id: int(a.id, 0, 1e9), at: num(a.at, now, now), text: text(a.text) }; }) : [];
  state.serial = Math.max(state.serial, ...state.diary.map(d => d.id));
  const w = obj(s.welcome);
  if (s.welcome) state.welcome = { seconds: int(w.seconds, 0, OFFLINE_CAP), shells: int(w.shells, 0, 200), hatched: int(w.hatched, 0, 12) };
  state.grants = Array.isArray(s.grants) ? s.grants.slice(0, 12).map(raw => { const g = obj(raw); return { id: text(g.id), shells: int(g.shells, 0, 200), items: Array.isArray(g.items) ? g.items.filter((v): v is ShopId => ['pink', 'lavender', 'sunset', 'night', 'arch', 'star'].includes(v)).slice(0, 6) : [] }; }).filter(g => /^idle-[a-z0-9]{6,30}-[1-9][0-9]{0,9}$/.test(g.id)) : [];
  for (const g of state.grants) state.serial = Math.max(state.serial, +g.id.split('-').at(-1)!);
  state.world = readWorld(s.world, state.total, now); state.world.room = Math.min(state.world.room, state.level - 1);
  if (!s.world) for (const p of state.photos) { const route = ROUTES.findIndex(r => r.name === p.place); if (route >= 0) state.world.map[route]++; }
  for (const c of Object.values(state.world.children)) c.room = Math.min(c.room, state.level - 1);
  state.world.hotel = state.world.hotel.filter(h => !seen.has(h.fish.id));
  state.serial = Math.max(state.serial, ...state.world.hotel.map(h => h.fish.id));
  return state;
}

export class IdleAquarium {
  state: IdleState;
  revision = 0;
  onChange = () => {};
  onGrant: (grant: Grant) => boolean = () => false;
  context: () => WorldContext = () => ({ fish: [], props: {} });
  constructor(raw?: unknown, now = Date.now()) { this.state = readIdleState(raw, now); }
  private changed() { this.revision++; this.onChange(); }
  private log(message: string, now: number) {
    this.state.diary.push({ id: ++this.state.serial, at: now, text: message });
    this.state.diary = this.state.diary.slice(-30);
  }
  private grant(shells: number, items: ShopId[] = []) {
    this.state.grants.push({ id: `idle-${this.state.epoch}-${++this.state.serial}`, shells, items });
    this.changed(); this.flushGrants();
  }
  // Save the grant first. A receipt in the notebook makes retries safe across reloads.
  flushGrants() {
    while (this.state.grants.length && this.onGrant(this.state.grants[0])) { this.state.grants.shift(); this.changed(); }
  }
  isAway(id: number) { const j = this.state.journey; return !!j && j.fishId === id && j.elapsed < ROUTES[j.route].seconds; }
  tick(now: number, discoveries = this.state.discoveries) {
    if (!Number.isFinite(now) || now <= this.state.lastSeen) return 0;
    const s = this.state, elapsed = Math.min(OFFLINE_CAP, (now - s.lastSeen) / 1000);
    s.lastSeen = now;
    const oldTotal = s.total, oldShells = s.shells, oldYoung = s.young.length, wasBloom = s.growth >= 1200;
    s.total = Math.min(1e9, s.total + elapsed); s.discoveries = Math.max(s.discoveries, int(discoveries, 0, 14));
    s.shellRemainder += elapsed; const found = Math.floor(s.shellRemainder / 300); s.shellRemainder %= 300;
    s.shells = Math.min(200, s.shells + found);
    if (found && s.shells > oldShells) this.log(`魚たちが貝殻を${s.shells - oldShells}個見つけた。`, now);
    s.growth = Math.min(1200, s.growth + elapsed);
    if (!wasBloom && s.growth >= 1200) this.log(`${GARDENS[s.garden]}が花を咲かせた。`, now);
    // Births and hatches are ordered by their elapsed-time timestamps, including offline gaps.
    const hatch = (time: number) => {
      const ready = s.eggs.filter(e => e.born + 1800 <= time);
      for (const egg of ready) if (s.young.length < 12) { s.young.push({ ...egg, born: egg.born + 1800 }); this.log('卵から小さなお魚が生まれた！', now); }
      s.eggs = s.eggs.filter(e => !ready.includes(e));
    };
    while (s.nextEgg <= s.total) {
      hatch(s.nextEgg);
      if (s.eggs.length < 3 && s.young.length + s.eggs.length < 12) {
        s.eggs.push({ id: ++s.serial, species: FISH_SPECIES[s.serial % FISH_SPECIES.length], born: s.nextEgg });
        this.log('海藻のかげに、小さな卵を見つけた。', now);
      }
      s.nextEgg += 7200;
    }
    hatch(s.total);
    const j = s.journey;
    if (j) {
      j.elapsed = Math.min(ROUTES[j.route].seconds, j.elapsed + elapsed);
      if (j.elapsed >= ROUTES[j.route].seconds && !j.recorded) { j.recorded = true; this.log(`${j.name || 'お魚'}が探検から帰ってきた。お土産を受け取ろう！`, now); }
    }
    for (let n = Math.floor(oldTotal / 1800) + 1; n <= Math.floor(s.total / 1800); n++) this.log(n % 2 ? 'カニが岩の上をおさんぽしていった。' : '魚たちが群れでゆっくり泳いでいた。', now);
    const timeLevel = s.total >= 14400 ? 4 : s.total >= 3600 ? 3 : s.total >= 600 ? 2 : 1;
    const discoveryLevel = s.discoveries >= 10 ? 4 : s.discoveries >= 7 ? 3 : s.discoveries >= 5 ? 2 : 1;
    const level = Math.min(timeLevel, discoveryLevel);
    while (s.level < level) {
      s.level++; this.log(`水槽がレベル${s.level}に育った！ 新しい景色が使えるよ。`, now);
      this.grant(0, s.level === 2 ? ['sunset'] : s.level === 3 ? ['night'] : ['arch', 'star']);
    }
    if (s.level >= 3) {
      s.fairyRemainder += elapsed;
      if (s.fairyRemainder >= 1800) { s.fairyRemainder %= 1800; if (!s.fairy) { s.fairy = true; this.log('貝の妖精が遊びに来た。いつでもお迎えしてね。', now); } }
    }
    if (elapsed >= 60) s.welcome = { seconds: Math.floor(elapsed), shells: s.shells - oldShells, hatched: s.young.length - oldYoung };
    advanceWorld(s.world, s.young, s.total, elapsed, now, s.epoch, this.context());
    this.changed(); this.flushGrants(); return elapsed;
  }
  get rewards() {
    const s = this.state;
    const entries = [
      { name: '貝殻ひろい', amount: s.shells },
      { name: 'お花の収穫', amount: s.growth >= 1200 ? 6 : 0 },
      { name: 'カニさんのお店', amount: s.world.crab.pending },
      { name: '貝の妖精', amount: s.fairy ? 6 : 0 },
      { name: '探検のお土産', amount: s.journey && s.journey.elapsed >= ROUTES[s.journey.route].seconds ? ROUTES[s.journey.route].shells : 0 },
    ].filter(entry => entry.amount > 0);
    return { entries, shells: entries.reduce((sum, entry) => sum + entry.amount, 0) };
  }
  claimAll(now = Date.now()) {
    const rewards = this.rewards;
    if (!rewards.shells) return 0;
    this.collectShells(); this.harvest(now); this.collectCrab(); this.greetFairy(now); this.receiveJourney(now);
    return rewards.shells;
  }
  collectShells() { const amount = this.state.shells; if (!amount) return false; this.state.shells = 0; this.grant(amount); return true; }
  harvest(now = Date.now()) {
    if (this.state.growth < 1200) return false;
    this.state.growth = 0; this.state.blooms++;
    const items: ShopId[] = this.state.blooms === 1 ? ['pink'] : this.state.blooms === 3 ? ['lavender'] : [];
    this.log('お花を収穫した。貝殻6個と、海藻の思い出。', now); this.grant(6, items); return true;
  }
  garden(index: number) { if (Number.isInteger(index) && index >= 0 && index < Math.min(3, this.state.level)) { this.state.garden = index; this.changed(); } }
  startJourney(fish: { id: number; species: FishSpecies }, name: string, bond: number, route: number, now = Date.now()) {
    const r = ROUTES[route];
    if (!r || !Number.isInteger(route) || !this.routeAvailable(route) || this.state.journey || !Number.isFinite(bond) || bond < r.bond || !Number.isSafeInteger(fish.id) || fish.id < 1) return false;
    this.state.journey = { fishId: fish.id, species: species(fish.species), name: name.slice(0, 16), route, elapsed: 0, recorded: false };
    this.log(`${name || 'お魚'}が${r.name}へ出発した。`, now); this.changed(); return true;
  }
  receiveJourney(now = Date.now()) {
    const j = this.state.journey; if (!j || j.elapsed < ROUTES[j.route].seconds) return false;
    const route = ROUTES[j.route], souvenir = SOUVENIRS[j.route === 1 ? 2 : this.state.trips % 2];
    this.state.trips++; if (!this.state.souvenirs.includes(souvenir)) this.state.souvenirs.push(souvenir);
    this.state.world.map[j.route]++;
    addLetter(this.state.world, now, j.name || 'お魚', `${route.name}の地図を描いてきたよ。新しい道を探してみよう！`, j.species);
    this.state.photos.push({ species: j.species, name: j.name || 'お魚', place: route.name }); this.state.photos = this.state.photos.slice(-12);
    this.state.journey = null; this.log(`探検のお土産「${souvenir}」と写真が届いた。`, now); this.grant(route.shells); return true;
  }
  greetFairy(now = Date.now()) { if (!this.state.fairy) return false; this.state.fairy = false; this.log('貝の妖精とごあいさつ。貝殻6個をもらった。', now); this.grant(6); return true; }
  toggleFeed() { this.state.autoFeed = !this.state.autoFeed; this.changed(); }
  dismissWelcome() { this.state.welcome = null; this.changed(); }
  routeAvailable(route: number) { const r = ROUTES[route]; if (!r || this.state.level < r.level) return false; return route < 2 || (route === 2 ? this.state.world.map[0] > 0 && this.state.world.map[1] > 0 : this.state.world.map[2] > 0); }
  greetCrab() { const c = this.state.world.crab; if (this.state.total < c.nextGreeting || c.bond >= 30) return false; c.bond++; c.nextGreeting = this.state.total + 900; this.changed(); return true; }
  collectCrab() { const c = this.state.world.crab; if (!c.pending) return false; const amount = c.pending; c.pending = 0; this.grant(amount); return true; }
  nameChild(id: number, value: string) { const c = this.state.world.children[id]; if (!c) return false; c.name = value.trim().slice(0, 16) || `ちび #${id}`; this.changed(); return true; }
  moveChild(id: number, room: number) { const c = this.state.world.children[id]; if (!c || !Number.isInteger(room) || room < 0 || room > Math.min(2, this.state.level - 1)) return false; c.room = room; this.changed(); return true; }
  petChild(id: number) { const c = this.state.world.children[id]; if (!c || this.state.total < c.lastPet) return false; c.affection = Math.min(100, c.affection + 1); c.lastPet = this.state.total + 10; this.changed(); return true; }
  captureLook(look: Look) { const room = this.state.world.rooms[this.state.world.room]; const copy = { theme: look.theme, plant: look.plant, rock: look.rock, props: structuredClone(look.props) }; if (JSON.stringify(room.look) !== JSON.stringify(copy)) { room.look = copy; this.changed(); } }
  selectRoom(room: number) { if (!Number.isInteger(room) || room < 0 || room > Math.min(2, this.state.level - 1)) return false; this.state.world.room = room; this.changed(); return true; }
  nameRoom(room: number, value: string) { if (!Number.isInteger(room) || room < 0 || room > 2) return false; this.state.world.rooms[room].name = value.trim().slice(0, 16) || ['はじめの水槽', '夕焼けの浅瀬', '星夜の水槽'][room]; this.changed(); return true; }
  readLetters() { this.state.world.read = this.state.world.serial; this.changed(); }
  hotelChild(id: number) {
    const f = this.state.young.find(f => f.id === id), c = this.state.world.children[id];
    if (!f || !c || c.stage < 2 || this.state.world.hotel.length >= 200) return false;
    this.state.world.hotel.push({ fish: { ...f }, child: { ...c } }); this.state.young = this.state.young.filter(f => f.id !== id); delete this.state.world.children[id]; this.changed(); return true;
  }
  restoreChild(id: number) {
    const index = this.state.world.hotel.findIndex(h => h.fish.id === id); if (index < 0 || this.state.young.length + this.state.eggs.length >= 12) return false;
    const [h] = this.state.world.hotel.splice(index, 1); h.child.room = Math.min(h.child.room, this.state.level - 1); this.state.young.push(h.fish); this.state.world.children[id] = h.child; this.changed(); return true;
  }
}
