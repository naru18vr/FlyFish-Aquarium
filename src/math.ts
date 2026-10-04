import type { Point, Rock } from './types';
export const BASE_WIDTH = 1200, BASE_HEIGHT = 720;
export let WIDTH = BASE_WIDTH, HEIGHT = BASE_HEIGHT;
export const BOUNDS = { left: 28, right: WIDTH - 28, top: 44, bottom: HEIGHT - 71 };
export const clamp = (x: number, lo = 0, hi = 1) => Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo;
export function setWorldSize(width: number, height: number) {
  WIDTH = Math.round(clamp(width, 640, 8192)); HEIGHT = Math.round(clamp(height, 360, 8192));
  BOUNDS.right = WIDTH - 28; BOUNDS.bottom = HEIGHT - 71;
}
export function tankSize(width: number, height: number) {
  if (!Number.isFinite(width + height) || width <= 0 || height <= 0) return { width: BASE_WIDTH, height: BASE_HEIGHT };
  const scale = Math.max(640 / width, 360 / height, Math.min(1, 1440 / width));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export class SpatialGrid<T extends Point> {
  private cells = new Map<string, T[]>();
  constructor(private size = 120) {}
  rebuild(objects: T[]) {
    this.cells.clear();
    for (const object of objects) {
      const key = `${Math.floor(object.x / this.size)},${Math.floor(object.y / this.size)}`;
      const cell = this.cells.get(key);
      if (cell) cell.push(object); else this.cells.set(key, [object]);
    }
  }
  near(point: Point, radius: number) {
    const result: T[] = [];
    for (let x = Math.floor((point.x - radius) / this.size); x <= Math.floor((point.x + radius) / this.size); x++)
      for (let y = Math.floor((point.y - radius) / this.size); y <= Math.floor((point.y + radius) / this.size); y++) {
        const cell = this.cells.get(`${x},${y}`);
        if (cell) for (const object of cell) if (distance(point, object) <= radius) result.push(object);
      }
    return result;
  }
}
// Position constraints remain active even at 100% neural control.
export function safePosition(point: Point, rocks: Rock[], radius = 13): { x: number; y: number; touched: boolean } {
  let x = clamp(point.x, BOUNDS.left + radius, BOUNDS.right - radius);
  let y = clamp(point.y, BOUNDS.top + radius, BOUNDS.bottom - radius);
  let touched = x !== point.x || y !== point.y;
  // Multiple projections handle obstacles adjacent to walls or one another.
  for (let pass = 0; pass < 4; pass++) for (const rock of rocks) {
    const dx = x - rock.x, dy = y - rock.y, d = Math.hypot(dx, dy), min = rock.r + radius;
    if (d < min) {
      touched = true;
      x = rock.x + (d > .001 ? dx / d : 0) * (min + .1);
      y = rock.y + (d > .001 ? dy / d : -1) * (min + .1);
    }
  }
  x = clamp(x, BOUNDS.left + radius, BOUNDS.right - radius);
  y = clamp(y, BOUNDS.top + radius, BOUNDS.bottom - radius);
  const valid = (p: Point) => p.x >= BOUNDS.left + radius && p.x <= BOUNDS.right - radius && p.y >= BOUNDS.top + radius && p.y <= BOUNDS.bottom - radius && rocks.every(r => distance(p, r) >= r.r + radius - .00001);
  if (valid({ x, y })) return { x, y, touched };
  // A final wall clamp can undo a circular projection. Resolve that corner
  // against the intersections of the expanded rocks and tank boundaries.
  const target = { x: clamp(point.x, BOUNDS.left + radius, BOUNDS.right - radius), y: clamp(point.y, BOUNDS.top + radius, BOUNDS.bottom - radius) };
  const candidates: Point[] = [];
  const xs = [BOUNDS.left + radius, BOUNDS.right - radius], ys = [BOUNDS.top + radius, BOUNDS.bottom - radius];
  for (const cx of xs) for (const cy of ys) candidates.push({ x: cx, y: cy });
  for (const rock of rocks) {
    const r = rock.r + radius + .01;
    for (const cy of ys) {
      const squared = r * r - (cy - rock.y) ** 2;
      if (squared >= 0) for (const sign of [-1, 1]) candidates.push({ x: rock.x + sign * Math.sqrt(squared), y: cy });
    }
    for (const cx of xs) {
      const squared = r * r - (cx - rock.x) ** 2;
      if (squared >= 0) for (const sign of [-1, 1]) candidates.push({ x: cx, y: rock.y + sign * Math.sqrt(squared) });
    }
    for (const angle of [Math.atan2(target.y - rock.y, target.x - rock.x), 0, Math.PI / 2, Math.PI, -Math.PI / 2]) candidates.push({ x: rock.x + Math.cos(angle) * r, y: rock.y + Math.sin(angle) * r });
    for (const other of rocks) {
      if (other === rock) continue;
      const d = distance(rock, other), q = other.r + radius + .01;
      if (d === 0 || d > r + q || d < Math.abs(r - q)) continue;
      const a = (r * r - q * q + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r * r - a * a));
      const dx = (other.x - rock.x) / d, dy = (other.y - rock.y) / d;
      for (const sign of [-1, 1]) candidates.push({ x: rock.x + a * dx - sign * h * dy, y: rock.y + a * dy + sign * h * dx });
    }
  }
  const safe = candidates.filter(valid).sort((a, b) => distance(a, target) - distance(b, target))[0];
  return { ...(safe ?? target), touched: true };
}
