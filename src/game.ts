import { angleDiff, clamp, distance } from './math';
import type { Fish, Point } from './types';
import { FISH_PROFILES, FISH_SPECIES } from './species';

export const GAME_KEY = 'flyfish-play-v1';
export const JOURNAL = [
  { id: 'meal', name: 'いただきます', hint: '魚が餌を食べるところを見よう。' },
  { id: 'school', name: 'いっしょに泳ごう', hint: '近くの3匹が同じ向きで泳ぐと発見。' },
  { id: 'escape', name: 'あぶない、すいすい', hint: '敵に気付いて逃げる魚を観察しよう。' },
  { id: 'station', name: '餌場で待ち合わせ', hint: '餌場のそばに3匹が集まると発見。' },
  { id: 'rest', name: 'ゆっくり、ゆらゆら', hint: 'ゆっくり泳ぐ魚を見つけよう。' },
  { id: 'friend', name: 'はじめての仲良し', hint: 'なでたり餌を食べたりして仲良し度を8に。' },
  { id: 'follow', name: 'こっちにおいで', hint: '仲良しの魚を呼んで、近くまで来てもらおう。' },
  { id: 'song', name: '小さな演奏会', hint: '音のフレーズをひとつ完成させよう。' },
  { id: 'decorate', name: 'わたしの水槽', hint: '貝殻で飾りを選んで置いてみよう。' },
  ...FISH_SPECIES.map(id => ({ id: `fish-${id}`, name: FISH_PROFILES[id].name, hint: 'この種類の魚が泳ぐ水槽を眺めよう。' })),
] as const;
export const SHOP = [
  { id: 'sunset', group: 'theme', name: '夕焼けの水', cost: 12, swatch: '#856b87' },
  { id: 'night', group: 'theme', name: '星夜の水', cost: 16, swatch: '#343f6c' },
  { id: 'pink', group: 'plant', name: '桃色の海藻', cost: 8, swatch: '#c49da9' },
  { id: 'lavender', group: 'rock', name: 'すみれ色の岩', cost: 8, swatch: '#9d96b7' },
  { id: 'shell', group: 'prop', name: '真珠の貝', cost: 6, swatch: '#f1c5bc' },
  { id: 'arch', group: 'prop', name: '小さなアーチ', cost: 14, swatch: '#99baae' },
  { id: 'star', group: 'prop', name: 'おほしさま', cost: 10, swatch: '#ebcb80' },
] as const;
export type ShopId = typeof SHOP[number]['id'];
export type VisitorKind = 'crab' | 'chest' | 'glow';
export const VISITORS: Record<VisitorKind, { name: string; hint: string; reward: number }> = {
  crab: { name: 'おさんぽカニ', hint: '岩の上をちょこちょこ。岩がないと泡にぷかり。', reward: 4 },
  chest: { name: '流れてきた宝箱', hint: '水の中をゆっくり流れる小さな宝箱。', reward: 7 },
  glow: { name: '夜のほたる魚', hint: '18時〜6時に遊ぶと会える、光る訪問者。', reward: 5 },
};
export const PHRASES = [
  { name: 'はじめての3音', notes: [0, 2, 4] },
  { name: '泡のかえりみち', notes: [4, 3, 1, 0] },
  { name: 'きらきら散歩', notes: [0, 2, 4, 6, 4] },
] as const;
export const NOTE_NAMES = ['1', '2', '3', '5', '6', '1↑', '2↑', '3↑', '5↑', '6↑'];
export const degreeOf = (id: number) => ((id - 1) % 10 + 10) % 10;
export const friendshipLabel = (value: number) => value >= 60 ? 'だいすき' : value >= 24 ? 'なかよし' : value >= 8 ? '顔なじみ' : 'はじめまして';
export interface FishFriend { name: string; bond: number; rewarded: number }
export interface GameState {
  version: 1; shells: number; gentle: boolean; followPointer: boolean; friends: Record<string, FishFriend>;
  found: string[]; owned: ShopId[]; theme: 'sea' | 'sunset' | 'night'; plant: 'green' | 'pink'; rock: 'moss' | 'lavender';
  props: Partial<Record<'shell' | 'arch' | 'star', { on: boolean; position: number }>>;
  visits: Record<VisitorKind, number>; songs: number[];
}
function integer(value: unknown, fallback: number, max: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.round(clamp(value, 0, max)) : fallback; }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function readGameState(raw: unknown): GameState {
  const s = object(raw);
  const state: GameState = { version: 1, shells: 8, gentle: false, followPointer: false, friends: {}, found: [], owned: [], theme: 'sea', plant: 'green', rock: 'moss', props: {}, visits: { crab: 0, chest: 0, glow: 0 }, songs: [] };
  if (s.version !== 1) return state;
  state.shells = integer(s.shells, 8, 99999); state.gentle = s.gentle === true; state.followPointer = s.followPointer === true;
  for (const [id, rawFriend] of Object.entries(object(s.friends)).slice(0, 512)) {
    if (!/^[1-9][0-9]{0,8}$/.test(id)) continue;
    const f = object(rawFriend), bond = integer(f.bond, 0, 100);
    state.friends[id] = { name: typeof f.name === 'string' ? f.name.trim().slice(0, 16) : '', bond, rewarded: Math.min(integer(f.rewarded, 0, 3), [8, 24, 60].filter(n => bond >= n).length) };
  }
  state.found = Array.isArray(s.found) ? [...new Set(s.found.filter((v): v is string => typeof v === 'string' && JOURNAL.some(j => j.id === v)))] : [];
  state.owned = Array.isArray(s.owned) ? [...new Set(s.owned.filter((v): v is ShopId => SHOP.some(item => item.id === v)))] : [];
  if ((s.theme === 'sunset' || s.theme === 'night') && state.owned.includes(s.theme)) state.theme = s.theme;
  if (s.plant === 'pink' && state.owned.includes('pink')) state.plant = 'pink';
  if (s.rock === 'lavender' && state.owned.includes('lavender')) state.rock = 'lavender';
  for (const id of ['shell', 'arch', 'star'] as const) if (state.owned.includes(id)) {
    const p = object(object(s.props)[id]); state.props[id] = { on: p.on === true, position: integer(p.position, 1, 2) };
  }
  for (const kind of ['crab', 'chest', 'glow'] as const) state.visits[kind] = integer(object(s.visits)[kind], 0, 9999);
  state.songs = Array.isArray(s.songs) ? [...new Set(s.songs.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < PHRASES.length))] : [];
  return state;
}
export class AquariumGame {
  state: GameState;
  time = 0; revision = 0;
  phrase: { index: number; step: number } | null = null;
  danceUntil = 0;
  danceSerial = 0;
  visitor: { kind: VisitorKind; born: number } | null = null;
  call: (Point & { until: number }) | null = null;
  pointer: Point | null = null;
  onChange = () => {};
  onNotice = (_message: string) => {};
  private lastPet = new Map<number, number>(); private lastMeal = new Map<number, number>();
  private nextVisitor = 45; private visitIndex = 0; private observeTime = 0;
  private schoolTime = 0; private restTime = 0;
  constructor(raw?: unknown) { this.state = readGameState(raw); }
  private changed() { this.revision++; this.onChange(); }
  private reward(amount: number) { this.state.shells = Math.min(99999, this.state.shells + amount); }
  friend(id: number): FishFriend { return this.state.friends[id] ?? { name: '', bond: 0, rewarded: 0 }; }
  name(id: number, name: string) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 999999999) return;
    this.state.friends[id] = { ...this.friend(id), name: name.trim().slice(0, 16) }; this.trimFriends(); this.changed();
  }
  private trimFriends() {
    const ids = Object.keys(this.state.friends);
    if (ids.length > 512) for (const id of ids.slice(0, ids.length - 512)) delete this.state.friends[id];
  }
  toggleFollow() { this.state.followPointer = !this.state.followPointer; this.clearPointer(); this.changed(); }
  movePointer(point: Point) {
    if (this.state.followPointer && Number.isFinite(point.x) && Number.isFinite(point.y)) this.pointer = { ...point };
  }
  clearPointer() { this.pointer = null; }
  followTarget(fish: Fish): Point | null {
    if (this.phrase || fish.fear >= .3 || Math.max(fish.startleLeft, fish.startleRight) > .2) return null;
    const friendly = this.friend(fish.id).bond >= 8;
    if (this.call && friendly) return this.call;
    const point = this.state.followPointer ? this.pointer : null;
    return point && distance(fish, point) <= (friendly ? 600 : 320) ? point : null;
  }
  toggleGentle() { this.state.gentle = !this.state.gentle; this.changed(); }
  private bond(id: number, amount: number) {
    const f = this.state.friends[id] = { ...this.friend(id) }; f.bond = Math.min(100, f.bond + amount);
    const level = [8, 24, 60].filter(n => f.bond >= n).length;
    if (level > f.rewarded) { this.reward((level - f.rewarded) * 3); f.rewarded = level; this.onNotice(`${f.name || `お魚 #${id}`}と${friendshipLabel(f.bond)}に！ 貝殻＋3`); }
    if (f.bond >= 8) this.discover('friend');
    this.trimFriends(); this.changed();
  }
  pet(id: number) {
    if (!this.state.gentle || this.time - (this.lastPet.get(id) ?? -Infinity) < 2) return false;
    this.lastPet.set(id, this.time); this.bond(id, 2); return true;
  }
  meal(fish: Fish) {
    this.discover('meal');
    if (this.time - (this.lastMeal.get(fish.id) ?? -Infinity) >= 5) { this.lastMeal.set(fish.id, this.time); this.bond(fish.id, 1); }
  }
  discover(id: string) {
    const entry = JOURNAL.find(j => j.id === id);
    if (!entry || this.state.found.includes(id)) return false;
    this.state.found.push(id); this.reward(4); this.changed(); this.onNotice(`発見「${entry.name}」 · 貝殻＋4`); return true;
  }
  startPhrase(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= PHRASES.length) return;
    this.phrase = { index, step: 0 }; this.revision++;
  }
  stopPhrase() { this.phrase = null; this.revision++; }
  note(id: number) {
    if (!this.phrase) return 'free';
    const phrase = PHRASES[this.phrase.index], degree = degreeOf(id);
    if (degree !== phrase.notes[this.phrase.step]) { this.phrase.step = degree === phrase.notes[0] ? 1 : 0; this.revision++; return 'retry'; }
    this.phrase.step++; this.revision++;
    if (this.phrase.step < phrase.notes.length) return 'next';
    const first = !this.state.songs.includes(this.phrase.index);
    if (first) { this.state.songs.push(this.phrase.index); this.reward(5); }
    this.phrase = null; this.danceUntil = this.time + 3; this.danceSerial++; this.discover('song'); this.changed();
    this.onNotice(first ? '演奏できた！ 魚たちもくるり。貝殻＋5' : 'もう一度、すてきな演奏！'); return 'complete';
  }
  buy(id: string) {
    const item = SHOP.find(i => i.id === id);
    if (!item) return false;
    if (!this.state.owned.includes(item.id)) {
      if (this.state.shells < item.cost) { this.onNotice('もう少し貝殻を集めよう。図鑑の発見や訪問者でもらえるよ。'); return false; }
      this.state.shells -= item.cost; this.state.owned.push(item.id);
    }
    if (item.group === 'theme') this.state.theme = item.id as 'sunset' | 'night';
    else if (item.group === 'plant') this.state.plant = 'pink';
    else if (item.group === 'rock') this.state.rock = 'lavender';
    else {
      const id = item.id as 'shell' | 'arch' | 'star';
      this.state.props[id] = { on: true, position: this.state.props[id]?.position ?? 1 };
    }
    this.discover('decorate'); this.changed(); return true;
  }
  baseLook() { this.state.theme = 'sea'; this.state.plant = 'green'; this.state.rock = 'moss'; for (const p of Object.values(this.state.props)) if (p) p.on = false; this.changed(); }
  prop(id: string, on: boolean, position: number) {
    if (!['shell', 'arch', 'star'].includes(id) || !this.state.owned.includes(id as ShopId)) return;
    this.state.props[id as 'shell' | 'arch' | 'star'] = { on, position: integer(position, 1, 2) }; this.changed();
  }
  callFriends(point: Point) { this.call = { ...point, until: this.time + 10 }; }
  visitorPoint(width: number, height: number, rocks = true): Point | null {
    if (!this.visitor) return null;
    const age = this.time - this.visitor.born;
    if (this.visitor.kind === 'crab') {
      const scale = Math.min(1.25, width / 1200);
      return { x: width * .2425 + Math.sin(age * .12) * 18 * scale, y: rocks ? height - 81 - 98 * scale : height - 160 };
    }
    if (this.visitor.kind === 'chest') return { x: width * (.58 + Math.sin(age * .08) * .18), y: Math.min(height - 100, 110 + age * 5) };
    return { x: width * (.5 + Math.sin(age * .17) * .27), y: Math.min(height - 110, height * .38 + Math.sin(age * .24) * 45) };
  }
  collectVisitor() {
    if (!this.visitor) return false;
    const kind = this.visitor.kind, visitor = VISITORS[kind]; this.visitor = null;
    this.state.visits[kind] = Math.min(9999, this.state.visits[kind] + 1); this.reward(visitor.reward); this.changed();
    this.onNotice(`${visitor.name}に会えた！ 貝殻＋${visitor.reward}`); return true;
  }
  // Progress uses active simulation time. Paused/background time earns no rewards.
  update(dt: number, fish: Fish[], stations: Point[], hour: number) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.time += Math.min(dt, 1);
    if (this.call && this.time > this.call.until) this.call = null;
    if (this.visitor && this.time - this.visitor.born > 90) { this.visitor = null; this.revision++; }
    if (this.time >= this.nextVisitor && !this.visitor) {
      const night = hour >= 18 || hour < 6;
      const rotation: VisitorKind[] = night ? ['crab', 'glow', 'chest'] : ['crab', 'chest'];
      const kind = rotation[this.visitIndex++ % rotation.length]; this.visitor = { kind, born: this.time };
      this.nextVisitor = this.time + 150; this.revision++; this.onNotice(`${VISITORS[kind].name}が遊びに来たよ！`);
    }
    this.observeTime += dt;
    if (this.observeTime < .5) return;
    const elapsed = this.observeTime; this.observeTime = 0;
    for (const f of fish) this.discover(`fish-${f.species}`);
    const school = fish.some(f => fish.filter(n => n !== f && distance(n, f) < 90 && Math.abs(angleDiff(n.angle, f.angle)) < .8).length >= 2);
    this.schoolTime = school ? this.schoolTime + elapsed : 0;
    if (this.schoolTime >= 3) this.discover('school');
    this.restTime = fish.some(f => f.speed < 40 && f.fear < .15) ? this.restTime + elapsed : 0;
    if (this.restTime >= 3) this.discover('rest');
    if (fish.some(f => f.sensory.enemyDistance < .65 && f.fear > .3 && f.action.accelerate > .55)) this.discover('escape');
    if (stations.some(s => fish.filter(f => distance(f, s) < 85).length >= 3)) this.discover('station');
    if (this.call && fish.some(f => this.friend(f.id).bond >= 8 && distance(f, this.call!) < 45)) this.discover('follow');
  }
}
