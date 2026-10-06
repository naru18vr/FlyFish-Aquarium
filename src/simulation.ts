import { angleDiff, BASE_HEIGHT, BASE_WIDTH, BOUNDS, clamp, distance, HEIGHT, random, safePosition, setWorldSize, SpatialGrid, WIDTH } from './math';
import { emptySense, idleMotor, type Fish, type Food, type Motor, type Point, type Predator, type Rock, type Settings, type Station } from './types';
import { FISH_PROFILES, FISH_SPECIES, PREDATOR_KINDS, PREDATOR_PROFILES } from './species';

export const MAX_FOOD = 100;
export class Aquarium {
  fish: Fish[] = []; predators: Predator[] = []; food: Food[] = []; stations: Station[] = [];
  readonly rocks: Rock[] = [{ x: 291, y: 600, r: 54 }, { x: 822, y: 597, r: 65 }, { x: 879, y: 628, r: 31 }];
  time = 0; eaten = 0; selected: number | null = null;
  private rng = random(481516); private foodId = 0;
  private fishGrid = new SpatialGrid<Fish>(); private foodGrid = new SpatialGrid<Food>(); private predatorGrid = new SpatialGrid<Predator>();
  private aiTime = 0;
  private stationLayout = '';
  onEat: (fish: Fish, manual: boolean) => void = () => {};
  isAway: (fish: Fish) => boolean = () => false;
  companion: ((fish: Fish) => Point | null) | null = null;
  constructor(public settings: Settings) { setWorldSize(BASE_WIDTH, BASE_HEIGHT); this.applySettings(); }
  get environmentScale() { return Math.min(1.25, WIDTH / BASE_WIDTH); }
  resize(width: number, height: number) {
    const oldWidth = WIDTH, oldHeight = HEIGHT;
    setWorldSize(width, height);
    const scale = this.environmentScale, ground = HEIGHT - 70;
    for (const [i, rock] of this.rocks.entries()) {
      rock.x = [291, 822, 879][i] / BASE_WIDTH * WIDTH;
      rock.y = ground - [50, 53, 22][i] * scale; rock.r = [54, 65, 31][i] * scale;
    }
    for (const object of [...this.fish, ...this.predators, ...this.food]) { object.x *= WIDTH / oldWidth; object.y *= HEIGHT / oldHeight; }
    this.applySettings();
    for (const food of this.food) Object.assign(food, safePosition(food, this.activeRocks(), 3));
    this.aiTime = .05;
    this.fishGrid.rebuild(this.fish.filter(f => !this.isAway(f))); this.foodGrid.rebuild(this.food); this.predatorGrid.rebuild(this.predators);
  }
  activeRocks() { return this.settings.rocks ? this.rocks : []; }
  applySettings() {
    while (this.predators.length < this.settings.predators) {
      const id = this.predators.length;
      this.predators.push({ id, kind: this.settings.predatorKind === 'mixed' ? PREDATOR_KINDS[id % PREDATOR_KINDS.length] : this.settings.predatorKind, x: WIDTH * (.7 + this.rng() * .15), y: HEIGHT * (.3 + this.rng() * .3), angle: this.rng() * Math.PI * 2, state: 'PATROL', timer: 3 + id, target: null });
    }
    this.predators.length = this.settings.predators;
    const layout = `${WIDTH}/${HEIGHT}/${this.settings.stations}/${this.settings.rocks}`;
    if (this.stationLayout !== layout) {
      const stations: Station[] = [];
      const scale = this.environmentScale, y = HEIGHT - 70 - 26 * scale;
      for (let i = 0; i < this.settings.stations; i++) {
        const preferred = 100 + (WIDTH - 200) * (i + .5) / this.settings.stations;
        let best = 60, bestDistance = Infinity;
        for (let x = 60 * scale; x <= WIDTH - 60 * scale; x += 4 * scale) {
          if (this.activeRocks().some(r => distance({ x, y }, r) < r.r + 28 * scale) || stations.some(s => Math.abs(s.x - x) < 64 * scale)) continue;
          if (Math.abs(x - preferred) < bestDistance) { best = x; bestDistance = Math.abs(x - preferred); }
        }
        stations.push({ x: best, y, timer: this.stations[i]?.timer ?? 1.2 + i * 1.7 });
      }
      this.stations = stations; this.stationLayout = layout;
    }
    while (this.fish.length < this.settings.fishCount) this.fish.push(this.spawnFish());
    this.fish.length = this.settings.fishCount;
    if (!this.fish.some(f => f.id === this.selected)) this.selected = null;
    for (const predator of this.predators) {
      const kind = this.settings.predatorKind === 'mixed' ? PREDATOR_KINDS[predator.id % PREDATOR_KINDS.length] : this.settings.predatorKind;
      if (kind !== predator.kind) { predator.kind = kind; predator.state = 'PATROL'; predator.target = null; predator.timer = 3 + predator.id; }
      const point = safePosition(predator, this.activeRocks(), 23); predator.x = point.x; predator.y = point.y;
    }
    for (const f of this.fish) {
      f.species = this.settings.fishSpecies === 'mixed' ? FISH_SPECIES[(f.id - 1) % FISH_SPECIES.length] : this.settings.fishSpecies;
      const position = safePosition(f, this.activeRocks()); f.x = position.x; f.y = position.y;
      f.flyWeight = this.settings.flyWeight; f.programWeight = 1 - this.settings.flyWeight;
    }
  }
  reset() {
    this.fish = []; this.predators = []; this.food = []; this.stations = [];
    this.time = 0; this.aiTime = 0; this.eaten = 0; this.selected = null; this.rng = random(481516); this.stationLayout = '';
    this.applySettings();
  }
  private spawnFish(): Fish {
    let point = { x: 150, y: 150 };
    for (let tries = 0; tries < 100; tries++) {
      point = { x: 65 + this.rng() * (WIDTH - 130), y: 90 + this.rng() * (HEIGHT - 220) };
      if (this.activeRocks().every(r => distance(point, r) > r.r + 24) && this.stations.every(s => distance(point, s) > 45) && this.predators.every(p => distance(point, p) > 85)) break;
    }
    const traits = () => this.rng() * 2 - 1;
    // A stable tank slot keeps names and friendship attached across reload/reset.
    let id = 1; while (this.fish.some(f => f.id === id)) id++;
    return { ...point, id, species: this.settings.fishSpecies === 'mixed' ? FISH_SPECIES[(id - 1) % FISH_SPECIES.length] : this.settings.fishSpecies, angle: this.rng() * Math.PI * 2, speed: 28 + this.rng() * 20, vx: 0, vy: 0,
      energy: .8 + this.rng() * .2, hunger: .3 + this.rng() * .5, fear: 0, color: Math.floor(this.rng() * 5), phase: this.rng() * Math.PI * 2,
      traits: { maxSpeed: traits(), turnSpeed: traits(), curiosity: traits(), fearSensitivity: traits(), foodSensitivity: traits(), brainNoise: traits() },
      startleLeft: 0, startleRight: 0, eating: 0, fly: idleMotor(), program: idleMotor(), action: idleMotor(), sensory: emptySense(), activity: Array(32).fill(0), spikes: 0, target: null,
      flyWeight: this.settings.flyWeight, programWeight: 1 - this.settings.flyWeight };
  }
  feed(x: number, surface = true, y = 48, count = 5, manual = true) {
    for (let i = 0; i < count && this.food.length < MAX_FOOD; i++) this.food.push({ id: ++this.foodId, x: clamp(x + (this.rng() - .5) * 32, BOUNDS.left + 10, BOUNDS.right - 10), y: surface ? BOUNDS.top + 5 + this.rng() * 10 : y, age: 0, manual, vx: (this.rng() - .5) * 9 });
  }
  pick(point: Point) {
    return this.fish.filter(f => !this.isAway(f)).reduce<Fish | null>((best, f) => distance(f, point) < 27 && (!best || distance(f, point) < distance(best, point)) ? f : best, null);
  }
  interact(point: Point, inspect = false) {
    const fish = this.pick(point);
    if (inspect) { this.selected = fish?.id ?? null; return fish ? 'inspect' : 'empty'; }
    if (!fish) { this.feed(point.x); return 'feed'; }
    if (!this.settings.scare) { this.selected = fish.id; return 'inspect'; }
    this.scare(fish, point);
    return 'scare';
  }
  scare(fish: Fish, point: Point) {
    const neighbours = this.fish.filter(f => !this.isAway(f) && distance(f, fish) < 170);
    for (const f of neighbours) {
      const d = distance(f, fish);
      const intensity = f === fish ? this.settings.startle : this.settings.startle * this.settings.nearby * (d < 85 ? .5 : .2);
      const side = (point.x - f.x) * -Math.sin(f.angle) + (point.y - f.y) * Math.cos(f.angle);
      if (side < 0) f.startleLeft = Math.max(f.startleLeft, intensity); else f.startleRight = Math.max(f.startleRight, intensity);
      // Only sensory state changes here. Physics responds to mixed motor output.
    }
    this.aiTime = .05;
  }
  private wall(point: Point) {
    const margin = Math.min(point.x - BOUNDS.left, BOUNDS.right - point.x, point.y - BOUNDS.top, BOUNDS.bottom - point.y);
    let result = clamp(1 - margin / 65);
    for (const r of this.activeRocks()) result = Math.max(result, clamp(1 - (distance(point, r) - r.r) / 65));
    return result;
  }
  senseAndThink() {
    this.fishGrid.rebuild(this.fish.filter(f => !this.isAway(f))); this.foodGrid.rebuild(this.food); this.predatorGrid.rebuild(this.predators);
    for (const f of this.fish) {
      if (this.isAway(f)) continue;
      const s = emptySense();
      const variation = this.settings.variation * .23;
      const sensitivity = 1 + f.traits.foodSensitivity * variation;
      const fearSensitivity = 1 + f.traits.fearSensitivity * variation;
      const project = (p: Point, range: number) => {
        const a = angleDiff(Math.atan2(p.y - f.y, p.x - f.x), f.angle);
        const strength = clamp(1 - distance(f, p) / range);
        return { left: a < 0 ? strength : 0, right: a >= 0 ? strength : 0, front: Math.abs(a) < .65 ? strength : 0, distance: 1 - strength };
      };
      const foods = this.foodGrid.near(f, 290 * sensitivity);
      let food: Food | null = null;
      for (const candidate of foods) if (!food || distance(f, candidate) < distance(f, food)) food = candidate;
      if (food) { const p = project(food, 290 * sensitivity); s.foodLeft = p.left; s.foodRight = p.right; s.foodFront = p.front; s.foodDistance = p.distance; }
      let enemy: Predator | null = null;
      for (const p of this.predatorGrid.near(f, 230 * fearSensitivity)) if (!enemy || distance(f, p) < distance(f, enemy)) enemy = p;
      if (enemy) { const p = project(enemy, 230 * fearSensitivity); s.enemyLeft = p.left; s.enemyRight = p.right; s.enemyFront = p.front; s.enemyDistance = p.distance; }
      const neighbours = this.fishGrid.near(f, 115).filter(other => other !== f);
      for (const other of neighbours) {
        const p = project(other, 115);
        s.fishLeft = Math.max(s.fishLeft, p.left); s.fishRight = Math.max(s.fishRight, p.right); s.fishFront = Math.max(s.fishFront, p.front); s.fishDistance = Math.min(s.fishDistance, p.distance);
      }
      const sample = (offset: number) => this.wall({ x: f.x + Math.cos(f.angle + offset) * 50, y: f.y + Math.sin(f.angle + offset) * 50 });
      s.wallLeft = sample(-.9); s.wallRight = sample(.9); s.wallFront = sample(0);
      s.touchLeft = s.wallLeft > .96 ? 1 : 0; s.touchRight = s.wallRight > .96 ? 1 : 0;
      s.startleLeft = clamp(f.startleLeft); s.startleRight = clamp(f.startleRight);
      f.sensory = s;
      let desired = f.angle + Math.sin(this.time * .5 + f.phase) * .6;
      let accel = .36, brake = s.wallFront * .45;
      f.target = null;
      const companion = this.companion?.(f);
      if (companion && !food) {
        const p = project(companion, 400);
        s.foodLeft = Math.max(s.foodLeft, p.left * .7); s.foodRight = Math.max(s.foodRight, p.right * .7); s.foodFront = Math.max(s.foodFront, p.front * .7);
        s.foodDistance = Math.min(s.foodDistance, p.distance);
        desired = Math.atan2(companion.y - f.y, companion.x - f.x); accel = distance(f, companion) > 50 ? .5 : .16; f.target = companion;
      }
      if (food && f.hunger > .1) { desired = Math.atan2(food.y - f.y, food.x - f.x); accel = .57; f.target = food; }
      else if (!companion && neighbours.length > 0) {
        const close = neighbours.find(n => distance(f, n) < 38);
        if (close) desired = Math.atan2(f.y - close.y, f.x - close.x);
        else desired += angleDiff(Math.atan2(neighbours.reduce((sum, n) => sum + Math.sin(n.angle), 0), neighbours.reduce((sum, n) => sum + Math.cos(n.angle), 0)), f.angle) * .28;
      }
      if (enemy) { desired = Math.atan2(f.y - enemy.y, f.x - enemy.x); accel = .75 + .25 * (1 - s.enemyDistance); f.target = enemy; }
      if (s.wallFront > .45) { desired = f.angle + (s.wallLeft < s.wallRight ? -1.6 : 1.6); brake = .3; }
      if (Math.max(s.startleLeft, s.startleRight) > .03) {
        desired = f.angle + (s.startleLeft > s.startleRight ? 1.9 : -1.9) + Math.sin(f.phase + this.time) * .25;
        accel = .65 + .35 * Math.max(s.startleLeft, s.startleRight); brake = 0;
      }
      const turn = clamp(angleDiff(desired, f.angle) / 1.4, -1, 1);
      f.program = { turnLeft: Math.max(0, -turn), turnRight: Math.max(0, turn), accelerate: accel, brake };
    }
  }
  update(dt: number) {
    dt = clamp(dt, 0, .04); this.time += dt; this.aiTime += dt;
    if (this.aiTime >= .05) { this.aiTime %= .05; this.senseAndThink(); }
    for (const s of this.stations) {
      s.timer -= dt;
      if (s.timer <= 0) { this.feed(s.x, false, s.y - 42 * this.environmentScale, 2, false); s.timer = 7 + this.rng() * 4; }
    }
    for (const food of this.food) {
      food.age += dt; food.y += (food.y > BOUNDS.bottom - 8 ? 0 : 13) * dt;
      food.x += (food.vx + Math.sin(food.age * 1.2) * 2) * dt; food.vx *= Math.exp(-dt * .8);
      const pos = safePosition(food, this.activeRocks(), 3); food.x = pos.x; food.y = pos.y;
    }
    this.food = this.food.filter(food => food.age < 45);
    for (const f of this.fish) {
      if (this.isAway(f)) continue;
      f.angle = Number.isFinite(f.angle) ? f.angle : 0;
      f.speed = clamp(f.speed, 0, 190);
      f.fear = clamp(f.fear);
      const w = this.settings.flyWeight;
      const mix = (key: keyof Motor) => clamp(f.fly[key] * w + f.program[key] * (1 - w));
      f.action = { turnLeft: mix('turnLeft'), turnRight: mix('turnRight'), accelerate: mix('accelerate'), brake: mix('brake') };
      f.flyWeight = w; f.programWeight = 1 - w;
      const variation = this.settings.variation * .23;
      const profile = FISH_PROFILES[f.species];
      f.angle += (f.action.turnRight - f.action.turnLeft) * 3.5 * profile.turn * (1 + f.traits.turnSpeed * variation) * dt;
      f.angle = angleDiff(f.angle, 0);
      const targetSpeed = clamp((22 + f.action.accelerate * 140) * profile.speed * (1 - f.action.brake * .65) * (1 + f.traits.maxSpeed * variation), 0, 190);
      f.speed += (targetSpeed - f.speed) * Math.min(1, dt * 3);
      if (this.settings.seaweed && f.y > HEIGHT - 255 && [80, 190, 610, 1040, 1120].some(x => Math.abs(x * WIDTH / BASE_WIDTH - f.x) < 26)) f.speed *= Math.exp(-dt * .5);
      f.vx = Math.cos(f.angle) * f.speed; f.vy = Math.sin(f.angle) * f.speed;
      // dt and speed bounds keep displacement smaller than fish radius, so no tunnelling.
      const pos = safePosition({ x: f.x + f.vx * dt, y: f.y + f.vy * dt }, this.activeRocks());
      f.x = pos.x; f.y = pos.y;
      if (pos.touched) { f.speed *= .93; f.startleLeft = Math.max(f.startleLeft, .08); }
      f.startleLeft *= Math.exp(-dt * 2); f.startleRight *= Math.exp(-dt * 2);
      const fear = Math.max(f.startleLeft, f.startleRight, 1 - f.sensory.enemyDistance);
      f.fear += (fear - f.fear) * Math.min(1, dt * 4);
      f.hunger = clamp(f.hunger + dt * .005); f.energy = clamp(f.energy + dt * (.002 - f.speed / 90000), .1, 1);
      f.eating = Math.max(0, f.eating - dt);
      for (const food of this.foodGrid.near(f, 19)) if (this.food.includes(food) && distance(f, food) < 19) {
        this.food.splice(this.food.indexOf(food), 1); f.hunger = clamp(f.hunger - .18); f.energy = clamp(f.energy + .06); f.eating = .55; this.eaten++;
        this.onEat(f, food.manual === true);
      }
    }
    for (const p of this.predators) {
      const profile = PREDATOR_PROFILES[p.kind];
      p.timer -= dt;
      if (p.state === 'PATROL') {
        p.angle += Math.sin(this.time * .4 + p.id) * dt * .25;
        const nearby = this.fishGrid.near(p, profile.range);
        if (nearby.length && p.timer < 0) { p.target = nearby.reduce((a, b) => distance(p, a) < distance(p, b) ? a : b); p.state = 'CHASE'; p.timer = profile.duration; }
      } else if (p.state === 'CHASE') {
        if (p.target && (this.fish.includes(p.target) && !this.isAway(p.target))) p.angle += clamp(angleDiff(Math.atan2(p.target.y - p.y, p.target.x - p.x), p.angle), -profile.turn * dt, profile.turn * dt);
        if (p.timer <= 0 || !p.target || !(this.fish.includes(p.target) && !this.isAway(p.target)) || distance(p, p.target) < 35) { p.state = 'COOLDOWN'; p.timer = profile.cooldown; p.target = null; }
      } else if (p.timer <= 0) { p.state = 'PATROL'; p.timer = 2; }
      let speed = p.state === 'CHASE' ? profile.chase : p.state === 'COOLDOWN' ? profile.rest : profile.patrol;
      if (p.kind === 'squid') speed *= .55 + .75 * Math.max(0, Math.sin(this.time * 6 + p.id));
      const drift = p.kind === 'jellyfish' ? Math.sin(this.time * 1.3 + p.id) * 9 : 0;
      const pos = safePosition({ x: p.x + Math.cos(p.angle) * speed * dt, y: p.y + (Math.sin(p.angle) * speed + drift) * dt }, this.activeRocks(), 23);
      p.x = pos.x; p.y = pos.y;
      if (pos.touched) p.angle += dt * 3;
    }
  }
}
