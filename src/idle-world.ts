import { FISH_SPECIES, type FishSpecies } from './species';
import type { GameState } from './game';

export const SHADES = ['いつもの色', '真珠いろ', '夕焼けいろ', 'ミントいろ'] as const;
export const PERSONALITIES = ['のんびり', '好奇心いっぱい', 'お花が好き'] as const;
export const PLACES = { seaweed: '海藻のかげ', shell: '真珠の貝', arch: '小さなアーチ', star: 'おほしさま' } as const;
export type Place = keyof typeof PLACES;
export type Look = Pick<GameState, 'theme' | 'plant' | 'rock' | 'props'>;
export interface Child { name: string; shade: number; personality: number; room: number; stage: number; favorite: Place; affection: number; lastPet: number }
export interface Letter { id: number; at: number; name: string; text: string; species: FishSpecies; shade: number; room: number }
export interface WorldState {
  room: number; rooms: { name: string; look: Look | null }[];
  children: Record<string, Child>; colors: string[];
  favorites: Record<string, { place: Place; affection: number; announced: boolean }>;
  crab: { bond: number; pending: number; remainder: number; nextGreeting: number };
  map: number[]; letters: Letter[]; serial: number; read: number; nextLetter: number;
  hotel: { fish: { id: number; species: FishSpecies; born: number }; child: Child }[];
}
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown, fallback = 0, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const integer = (v: unknown, fallback = 0, max = 1e9) => Math.floor(number(v, fallback, max));
const name = (v: unknown, fallback: string) => typeof v === 'string' ? v.slice(0, 16).trim() || fallback : fallback;
const place = (v: unknown): Place => typeof v === 'string' && Object.hasOwn(PLACES, v) ? v as Place : 'seaweed';
export function readWorld(raw: unknown, total: number, now = Date.now()): WorldState {
  const s = record(raw), crab = record(s.crab);
  const w: WorldState = { room: integer(s.room, 0, 2), rooms: ['はじめの水槽', '夕焼けの浅瀬', '星夜の水槽'].map((title, i) => ({ name: title, look: i ? { theme: i === 1 ? 'sunset' : 'night', plant: i === 1 ? 'pink' : 'green', rock: 'moss', props: {} } : null })), children: {}, colors: [], favorites: {}, crab: { bond: integer(crab.bond, 0, 30), pending: integer(crab.pending, 0, 100), remainder: number(crab.remainder, 0, 3599.999), nextGreeting: number(crab.nextGreeting, 0, total + 900) }, map: [0, 0, 0, 0], letters: [], serial: integer(s.serial), read: integer(s.read), nextLetter: number(s.nextLetter, total + 1800, total + 1800), hotel: [] };
  if (Array.isArray(s.rooms)) s.rooms.slice(0, 3).forEach((v, i) => {
    const r = record(v), l = record(r.look); w.rooms[i].name = name(r.name, w.rooms[i].name);
    if (!r.look) return;
    const look: Look = { theme: l.theme === 'sunset' || l.theme === 'night' ? l.theme : 'sea', plant: l.plant === 'pink' ? 'pink' : 'green', rock: l.rock === 'lavender' ? 'lavender' : 'moss', props: {} };
    for (const id of ['shell', 'arch', 'star'] as const) { const p = record(record(l.props)[id]); look.props[id] = { on: p.on === true, position: integer(p.position, 1, 2) }; }
    w.rooms[i].look = look;
  });
  for (const [id, v] of Object.entries(record(s.children)).slice(0, 12)) {
    if (!/^[1-9][0-9]{0,9}$/.test(id)) continue; const c = record(v);
    w.children[id] = { name: name(c.name, `ちび #${id}`), shade: integer(c.shade, 0, 3), personality: integer(c.personality, 0, 2), room: integer(c.room, 0, 2), stage: integer(c.stage, 0, 2), favorite: place(c.favorite), affection: number(c.affection, 0, 100), lastPet: number(c.lastPet, 0, total + 10) };
  }
  w.colors = Array.isArray(s.colors) ? [...new Set(s.colors.filter((v): v is string => typeof v === 'string' && FISH_SPECIES.some(f => [0, 1, 2, 3].some(c => v === `${f}:${c}`))))] : [];
  for (const [id, v] of Object.entries(record(s.favorites)).slice(0, 40)) { if (!/^[1-9][0-9]{0,8}$/.test(id)) continue; const f = record(v); w.favorites[id] = { place: place(f.place), affection: number(f.affection, 0, 100), announced: f.announced === true }; }
  if (Array.isArray(s.map)) w.map = [0, 1, 2, 3].map(i => integer((s.map as unknown[])[i], 0, 99999));
  if (Array.isArray(s.letters)) w.letters = s.letters.slice(-30).map(v => { const l = record(v); return { id: integer(l.id), at: number(l.at, now, now), name: name(l.name, 'お魚'), text: typeof l.text === 'string' ? l.text.slice(0, 120) : '', species: FISH_SPECIES.includes(l.species as FishSpecies) ? l.species as FishSpecies : 'goldfish', shade: integer(l.shade, 0, 3), room: integer(l.room, 0, 2) }; });
  w.serial = Math.max(w.serial, ...w.letters.map(l => l.id)); w.read = Math.min(w.read, w.serial);
  const seen = new Set<number>();
  if (Array.isArray(s.hotel)) for (const v of s.hotel.slice(0, 200)) {
    const h = record(v), f = record(h.fish), c = record(h.child), id = integer(f.id);
    if (!id || seen.has(id)) continue; seen.add(id);
    w.hotel.push({ fish: { id, species: FISH_SPECIES.includes(f.species as FishSpecies) ? f.species as FishSpecies : 'goldfish', born: number(f.born, 0, total) }, child: { name: name(c.name, `ちび #${id}`), shade: integer(c.shade, 0, 3), personality: integer(c.personality, 0, 2), room: integer(c.room, 0, 2), stage: 2, favorite: place(c.favorite), affection: number(c.affection, 0, 100), lastPet: number(c.lastPet, 0, total + 10) } });
  }
  return w;
}
export function stage(age: number) { return age >= 14400 ? 2 : age >= 3600 ? 1 : 0; }
export const STAGES = ['稚魚', '少し大きなお魚', '大人のお魚'] as const;
export function addLetter(w: WorldState, at: number, fishName: string, text: string, species: FishSpecies = 'goldfish', shade = 0, room = 0) {
  w.letters.push({ id: ++w.serial, at, name: fishName.slice(0, 16), text: text.slice(0, 120), species, shade, room }); w.letters = w.letters.slice(-30);
}
export interface WorldContext { fish: { id: number; name: string; species: FishSpecies }[]; props: Look['props'] }
export function advanceWorld(w: WorldState, young: { id: number; species: FishSpecies; born: number }[], total: number, elapsed: number, now: number, epoch: string, context: WorldContext) {
  const ids = new Set(young.map(f => String(f.id))); for (const id of Object.keys(w.children)) if (!ids.has(id)) delete w.children[id];
  w.crab.remainder += elapsed;
  const shifts = Math.floor(w.crab.remainder / 3600); w.crab.remainder %= 3600;
  if (shifts) w.crab.pending = Math.min(100, w.crab.pending + shifts * (w.crab.bond >= 15 ? 6 : w.crab.bond >= 5 ? 4 : 2));
  const choices = ['seaweed', ...Object.entries(context.props).filter(([, p]) => p?.on).map(([id]) => id)] as Place[];
  for (const f of young) {
    let c = w.children[f.id];
    if (!c) {
      let seed = f.id; for (const letter of epoch) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
      const shade = seed % 5 === 0 ? 1 + seed % 3 : 0;
      c = w.children[f.id] = { name: `ちび #${f.id}`, shade, personality: seed % 3, room: 0, stage: 0, favorite: choices[seed % choices.length], affection: 0, lastPet: 0 };
      const key = `${f.species}:${shade}`; if (!w.colors.includes(key)) w.colors.push(key);
      addLetter(w, now, c.name, `${SHADES[shade]}の小さな魚が仲間になった！`, f.species, shade);
    }
    const color = `${f.species}:${c.shade}`; if (!w.colors.includes(color)) w.colors.push(color);
    const next = stage(total - f.born);
    if (next > c.stage) { c.stage = next; addLetter(w, now, c.name, `${STAGES[next]}に育ったよ。性格は「${PERSONALITIES[c.personality]}」。`, f.species, c.shade, c.room); }
    c.affection = Math.min(100, c.affection + Math.min(elapsed, Math.max(0, total - f.born)) / 3600);
  }
  if (total >= 600) for (const f of context.fish.slice(0, 40)) {
    const favorite = w.favorites[f.id] ??= { place: choices[(f.id - 1) % choices.length], affection: 0, announced: false };
    favorite.affection = Math.min(100, favorite.affection + elapsed / 1800);
    if (favorite.affection >= 2 && !favorite.announced) { favorite.announced = true; addLetter(w, now, f.name, `${PLACES[favorite.place]}がお気に入りになった。ときどきここでひと休み。`, f.species); }
  }
  if (total >= w.nextLetter) {
    w.nextLetter = total + 1800;
    const f = young.length ? young[w.serial % young.length] : null;
    if (f) { const c = w.children[f.id]; addLetter(w, now, c.name, `${w.rooms[c.room].name}からのお便り。${PLACES[c.favorite]}のそばで、今日ものんびり泳いだよ。`, f.species, c.shade, c.room); }
    else if (context.fish.length) { const fish = context.fish[w.serial % context.fish.length]; addLetter(w, now, fish.name, 'お花のそばを泳いで、泡を見つけたよ。水槽からの小さな思い出。', fish.species); }
  }
}
