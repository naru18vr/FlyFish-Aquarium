import type { Point, Rock } from './types';
export const WIDTH = 1200, HEIGHT = 720;
export const BOUNDS = { left: 28, right: WIDTH - 28, top: 44, bottom: HEIGHT - 71 };
export const clamp = (x: number, lo = 0, hi = 1) => Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo;
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
  return { x: clamp(x, BOUNDS.left + radius, BOUNDS.right - radius), y: clamp(y, BOUNDS.top + radius, BOUNDS.bottom - radius), touched };
}
