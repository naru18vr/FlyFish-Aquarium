import { FISH_SPECIES, type FishSpecies } from './species';
import type { ShopId } from './game';

export const IDLE_KEY = 'flyfish-idle-v1';
export const OFFLINE_CAP = 8 * 3600;
export const GARDENS = ['みどりの海藻', '桃色のお花', '星の海藻'] as const;
export const ROUTES = [
  { name: '浅瀬のおさんぽ', seconds: 3600, shells: 12, bond: 8, level: 1 },
  { name: '星砂の入り江', seconds: 10800, shells: 30, bond: 24, level: 3 },
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
}
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const num = (v: unknown, fallback: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const int = (v: unknown, fallback: number, max: number) => Math.floor(num(v, fallback, max));
const species = (v: unknown): FishSpecies => FISH_SPECIES.includes(v as FishSpecies) ? v as FishSpecies : 'goldfish';
const text = (v: unknown, fallback = '') => typeof v === 'string' ? v.slice(0, 120) : fallback;
export function readIdleState(raw: unknown, now: number): IdleState {
  const s = obj(raw);
  const state: IdleState = { version: 1, epoch: now.toString(36) + Math.random().toString(36).slice(2, 8), lastSeen: now, total: 0, shells: 0, shellRemainder: 0, garden: 0, growth: 0, blooms: 0, level: 1, discoveries: 0,
    journey: null, trips: 0, souvenirs: [], photos: [], eggs: [], young: [], nextEgg: 1200, serial: 0, fairy: false, fairyRemainder: 0, autoFeed: true, diary: [], welcome: null, grants: [] };
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
    const j = obj(s.journey), route = int(j.route, 0, 1), fishId = int(j.fishId, 0, 999999999);
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
  return state;
}

export class IdleAquarium {
  state: IdleState;
  revision = 0;
  onChange = () => {};
  onGrant: (grant: Grant) => boolean = () => false;
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
    this.changed(); this.flushGrants(); return elapsed;
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
    if (!r || !Number.isInteger(route) || this.state.journey || !Number.isFinite(bond) || bond < r.bond || this.state.level < r.level || !Number.isSafeInteger(fish.id) || fish.id < 1) return false;
    this.state.journey = { fishId: fish.id, species: species(fish.species), name: name.slice(0, 16), route, elapsed: 0, recorded: false };
    this.log(`${name || 'お魚'}が${r.name}へ出発した。`, now); this.changed(); return true;
  }
  receiveJourney(now = Date.now()) {
    const j = this.state.journey; if (!j || j.elapsed < ROUTES[j.route].seconds) return false;
    const route = ROUTES[j.route], souvenir = SOUVENIRS[j.route === 1 ? 2 : this.state.trips % 2];
    this.state.trips++; if (!this.state.souvenirs.includes(souvenir)) this.state.souvenirs.push(souvenir);
    this.state.photos.push({ species: j.species, name: j.name || 'お魚', place: route.name }); this.state.photos = this.state.photos.slice(-12);
    this.state.journey = null; this.log(`探検のお土産「${souvenir}」と写真が届いた。`, now); this.grant(route.shells); return true;
  }
  greetFairy(now = Date.now()) { if (!this.state.fairy) return false; this.state.fairy = false; this.log('貝の妖精とごあいさつ。貝殻6個をもらった。', now); this.grant(6); return true; }
  toggleFeed() { this.state.autoFeed = !this.state.autoFeed; this.changed(); }
  dismissWelcome() { this.state.welcome = null; this.changed(); }
}
