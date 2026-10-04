import { describe, expect, it } from 'vitest';
import data from '../../public/data/connectome.json';
import { BrainModel } from '../../src/brain/model';
import { isConnectome } from '../../src/brain/connectome';
import { Aquarium, MAX_FOOD } from '../../src/simulation';
import { BASE_HEIGHT, BASE_WIDTH, BOUNDS, distance, HEIGHT, safePosition, SpatialGrid, tankSize, WIDTH } from '../../src/math';
import { DEFAULTS, emptySense, type Connectome, type Quality } from '../../src/types';
import { FISH_SPECIES, PREDATOR_KINDS } from '../../src/species';

const connectome = data as unknown as Connectome;
describe('measured neural circuit', () => {
  it('rejects malformed sensory groups, corrupt edges and numeric root IDs', () => {
    expect(isConnectome(data)).toBe(true);
    expect(isConnectome({ ...data, neurons: [{ ...data.neurons[0], adapterGroup: 8 }] })).toBe(false);
    expect(isConnectome({ ...data, neurons: [{ ...data.neurons[0], id: 123 }] })).toBe(false);
    expect(isConnectome({ ...data, edges: [[0, 768, 5]] })).toBe(false);
    expect(isConnectome({ ...data, edges: [[0, 1, -1]] })).toBe(false);
    expect(isConnectome(null)).toBe(false);
  });
  it('keeps large anatomical root IDs and real, positive synapse counts', () => {
    expect(new Set(data.neurons.map(n => n.id)).size).toBe(768);
    expect(data.edges.length).toBe(25274);
    expect(data.neurons.every(n => typeof n.id === 'string' && n.id.length > 16)).toBe(true);
    expect(data.edges.every(([a, b, count]) => a !== b && a >= 0 && b < 768 && count >= 5)).toBe(true);
    expect(data.sourceCommit).toBe('ee4944c03429edf857a6b10bcf98bea7dcef35b8');
  });
  it.each(['low', 'medium', 'high'] as Quality[])('responds to lateral startle with the opposite motor bias at %s quality', quality => {
    const brain = new BrainModel(connectome, quality);
    const sensory = emptySense(); sensory.startleLeft = 1;
    let left = 0, right = 0;
    for (let i = 0; i < 8; i++) { const output = brain.step(1, sensory, 0); left += output.motor.turnLeft; right += output.motor.turnRight; }
    expect(right).toBeGreaterThan(left + .3);
  });
  it('keeps fish states independent', () => {
    const brain = new BrainModel(connectome, 'medium');
    const control = new BrainModel(connectome, 'medium');
    const stimulus = { ...emptySense(), startleRight: 1 };
    for (let i = 0; i < 10; i++) brain.step(1, stimulus);
    expect(brain.step(2, emptySense())).toEqual(control.step(2, emptySense()));
  });
  it('bounds neural activity under repeated maximal sensory stimulation', () => {
    const brain = new BrainModel(connectome, 'high');
    const stimulus = Object.fromEntries(Object.keys(emptySense()).map(key => [key, 1])) as unknown as ReturnType<typeof emptySense>;
    for (let i = 0; i < 40; i++) {
      const output = brain.step(4, stimulus, .4);
      expect(Object.values(output.motor).every(n => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true);
      expect(output.activity.every(n => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true);
    }
  });
});
describe('aquarium interactions and safety', () => {
  it('fills portrait, landscape and large viewports without stretching sprites', () => {
    for (const [width, height] of [[320, 640], [412, 915], [844, 390], [1440, 1080], [3840, 2160]]) {
      const world = tankSize(width, height);
      expect(world.width).toBeGreaterThanOrEqual(640); expect(world.height).toBeGreaterThanOrEqual(360);
      expect(Math.abs(world.width / world.height - width / height)).toBeLessThan(.002);
    }
    expect(tankSize(0, NaN)).toEqual({ width: BASE_WIDTH, height: BASE_HEIGHT });
  });
  it('preserves fish identities and brain state while resizing, rotating and resetting the aquarium', () => {
    const sim = new Aquarium({ ...DEFAULTS, fishCount: 40, predators: 8, stations: 6 });
    const fish = sim.fish[0], ids = sim.fish.map(f => f.id);
    fish.hunger = .73; fish.activity[0] = .8; fish.spikes = 7; sim.selected = fish.id;
    sim.feed(500);
    try {
      for (const [width, height] of [[640, 1385], [844, 390], [1440, 1080], [640, 360], [1200, 720]]) {
        sim.resize(width, height);
        expect(sim.fish.map(f => f.id)).toEqual(ids); expect(sim.fish[0]).toBe(fish);
        expect(fish.hunger).toBe(.73); expect(fish.activity[0]).toBe(.8); expect(fish.spikes).toBe(7); expect(sim.selected).toBe(fish.id);
        for (const object of [...sim.fish, ...sim.predators, ...sim.food]) {
          const radius = 'speed' in object ? 13 : 'kind' in object ? 23 : 3;
          expect(Number.isFinite(object.x + object.y)).toBe(true);
          expect(object.x).toBeGreaterThanOrEqual(BOUNDS.left + radius); expect(object.x).toBeLessThanOrEqual(BOUNDS.right - radius);
          expect(object.y).toBeGreaterThanOrEqual(BOUNDS.top + radius); expect(object.y).toBeLessThanOrEqual(BOUNDS.bottom - radius);
          expect(sim.rocks.every(r => distance(object, r) >= r.r + radius - .001)).toBe(true);
        }
        for (let stations = 1; stations <= 6; stations++) {
          sim.settings.stations = stations; sim.applySettings();
          expect(sim.stations).toHaveLength(stations);
          expect(sim.stations.every(s => sim.rocks.every(r => distance(s, r) >= r.r + 28 * sim.environmentScale - .001))).toBe(true);
          for (let i = 1; i < stations; i++) expect(sim.stations.slice(0, i).every(s => Math.abs(s.x - sim.stations[i].x) >= 64 * sim.environmentScale - .001)).toBe(true);
        }
      }
      sim.resize(640, 1280); sim.reset();
      expect(WIDTH).toBe(640); expect(HEIGHT).toBe(1280);
      expect(sim.fish).toHaveLength(40); expect(sim.predators).toHaveLength(8); expect(sim.stations).toHaveLength(6);
      for (let i = 0; i < 1200; i++) sim.update(1 / 60);
      expect(sim.fish.every(f => Number.isFinite(f.x + f.y) && f.y <= BOUNDS.bottom && sim.rocks.every(r => distance(f, r) >= r.r + 13 - .001))).toBe(true);
    } finally { sim.resize(BASE_WIDTH, BASE_HEIGHT); }
  });
  it('mixes five fish species and three enemy kinds without resetting independent fish', () => {
    const sim = new Aquarium({ ...DEFAULTS, predators: 3 });
    expect(new Set(sim.fish.map(f => f.species))).toEqual(new Set(FISH_SPECIES));
    expect(new Set(sim.predators.map(p => p.kind))).toEqual(new Set(PREDATOR_KINDS));
    const fish = sim.fish[0]; fish.hunger = .73; fish.startleLeft = .4; sim.selected = fish.id;
    for (const species of FISH_SPECIES) {
      sim.settings.fishSpecies = species; sim.applySettings();
      expect(sim.fish.every(f => f.species === species)).toBe(true);
      expect(sim.fish[0]).toBe(fish); expect(fish.hunger).toBe(.73); expect(fish.startleLeft).toBe(.4); expect(sim.selected).toBe(fish.id);
    }
    sim.settings.fishSpecies = 'mixed'; sim.applySettings();
    expect(new Set(sim.fish.map(f => f.species))).toEqual(new Set(FISH_SPECIES));
  });
  it('switches enemy kinds in place and resets old chase targets', () => {
    const sim = new Aquarium({ ...DEFAULTS, predators: 8 });
    const ids = sim.predators.map(p => p.id);
    for (const kind of PREDATOR_KINDS) {
      const changedIds = sim.predators.filter(p => p.kind !== kind).map(p => p.id);
      sim.predators.forEach(p => { p.state = 'CHASE'; p.target = sim.fish[0]; });
      sim.settings.predatorKind = kind; sim.applySettings();
      expect(sim.predators.every(p => p.kind === kind)).toBe(true);
      expect(sim.predators.map(p => p.id)).toEqual(ids);
      expect(sim.predators.filter(p => changedIds.includes(p.id)).every(p => p.state === 'PATROL' && p.target === null)).toBe(true);
    }
    sim.settings.predatorKind = 'mixed'; sim.applySettings();
    expect(new Set(sim.predators.map(p => p.kind))).toEqual(new Set(PREDATOR_KINDS));
  });
  it('gives squid bursts, sharks sustained pursuit, and jellyfish slower drifting', () => {
    const travelled = PREDATOR_KINDS.map(kind => {
      const sim = new Aquarium({ ...DEFAULTS, predatorKind: kind }); sim.time = .25;
      const p = sim.predators[0]; Object.assign(p, { x: 300, y: 250, angle: 0, state: 'CHASE', timer: 5, target: sim.fish[0] });
      Object.assign(sim.fish[0], { x: 600, y: 250 }); sim.update(.04);
      return distance(p, { x: 300, y: 250 });
    });
    expect(travelled[2]).toBeGreaterThan(travelled[0]); expect(travelled[0]).toBeGreaterThan(travelled[1] * 2);
  });
  it.each([3, 13, 23])('resolves every point beside overlapping rocks and the floor at radius %s', radius => {
    const sim = new Aquarium({ ...DEFAULTS });
    for (let x = 750; x <= 930; x += 4) for (let y = 560; y <= 680; y += 4) {
      const point = safePosition({ x, y }, sim.rocks, radius);
      expect(point.y).toBeLessThanOrEqual(BOUNDS.bottom - radius);
      expect(sim.rocks.every(r => distance(point, r) >= r.r + radius - .001)).toBe(true);
    }
  });
  it('places every feeding station clear of rocks at every count', () => {
    for (let stations = 1; stations <= 6; stations++) {
      const sim = new Aquarium({ ...DEFAULTS, stations });
      expect(sim.stations.every(s => sim.rocks.every(r => distance(s, r) >= r.r + 28))).toBe(true);
      sim.settings.rocks = false; sim.applySettings();
      sim.settings.rocks = true; sim.applySettings();
      expect(sim.stations.every(s => sim.rocks.every(r => distance(s, r) >= r.r + 28))).toBe(true);
    }
  });
  it('starts with 24 fish and the specified environment', () => {
    const sim = new Aquarium({ ...DEFAULTS });
    expect(sim.fish).toHaveLength(24); expect(sim.predators).toHaveLength(1); expect(sim.stations).toHaveLength(2);
    for (const fish of sim.fish) expect(sim.rocks.every(r => distance(fish, r) >= r.r + 13)).toBe(true);
    for (const fish of sim.fish) expect(sim.stations.every(s => distance(fish, s) > 45) && sim.predators.every(p => distance(fish, p) > 85)).toBe(true);
  });
  it('prioritizes fish clicks and propagates sensory stimulation without moving fish', () => {
    const sim = new Aquarium({ ...DEFAULTS });
    const [a, b, c] = sim.fish;
    Object.assign(a, { x: 300, y: 300, angle: 0 }); Object.assign(b, { x: 330, y: 310 }); Object.assign(c, { x: 900, y: 300 });
    const position = { x: a.x, y: a.y };
    expect(sim.interact(a)).toBe('scare'); expect(sim.food).toHaveLength(0);
    expect(Math.max(a.startleLeft, a.startleRight)).toBeGreaterThan(0);
    expect(Math.max(b.startleLeft, b.startleRight)).toBeGreaterThan(0);
    expect(Math.max(c.startleLeft, c.startleRight)).toBe(0);
    expect({ x: a.x, y: a.y }).toEqual(position);
  });
  it('inspection does not scare or feed; empty clicks spawn food at the surface', () => {
    const sim = new Aquarium({ ...DEFAULTS });
    expect(sim.interact(sim.fish[0], true)).toBe('inspect'); expect(sim.fish[0].startleLeft + sim.fish[0].startleRight).toBe(0);
    sim.fish.forEach(f => { f.x = 300; f.y = 300; });
    expect(sim.interact({ x: 900, y: 400 })).toBe('feed');
    expect(sim.food).toHaveLength(5); expect(sim.food.every(f => f.y < BOUNDS.top + 20)).toBe(true);
  });
  it('caps food and consumes it once when a fish reaches it', () => {
    const sim = new Aquarium({ ...DEFAULTS, stations: 0, predators: 0, flyWeight: 0 });
    for (let i = 0; i < 40; i++) sim.feed(500);
    expect(sim.food).toHaveLength(MAX_FOOD);
    sim.food = []; const fish = sim.fish[0]; fish.hunger = .8;
    sim.feed(fish.x, false, fish.y, 1); sim.food[0].x = fish.x;
    sim.update(.05); sim.update(.05);
    expect(sim.eaten).toBe(1); expect(fish.hunger).toBeLessThan(.8);
  });
  it.each([0, .7, 1])('keeps 40 fish finite, inside the tank, and outside rocks at brain weight %s', weight => {
    const sim = new Aquarium({ ...DEFAULTS, fishCount: 40, predators: 8, stations: 6, flyWeight: weight });
    // Deliberately steer toward obstacles, including at pure neural control.
    for (const fish of sim.fish) fish.fly = { turnLeft: 0, turnRight: .12, accelerate: 1, brake: 0 };
    for (let i = 0; i < 3600; i++) sim.update(1 / 60);
    expect(sim.fish).toHaveLength(40);
    for (const f of [...sim.fish, ...sim.predators]) {
      expect(Number.isFinite(f.x + f.y + f.angle)).toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(BOUNDS.left); expect(f.x).toBeLessThanOrEqual(BOUNDS.right);
      expect(f.y).toBeGreaterThanOrEqual(BOUNDS.top); expect(f.y).toBeLessThanOrEqual(BOUNDS.bottom);
      expect(sim.rocks.every(r => distance(f, r) >= r.r + ('speed' in f ? 13 : 23) - .01)).toBe(true);
    }
  });
  it('handles corrupted positions without NaN and pushes out of rock centers', () => {
    expect(Number.isFinite(safePosition({ x: NaN, y: Infinity }, []).x)).toBe(true);
    const r = { x: 500, y: 400, r: 60 }; expect(distance(safePosition(r, [r]), r)).toBeGreaterThanOrEqual(73);
  });
  it('recovers an invalid fish position, heading, and speed', () => {
    const sim = new Aquarium({ ...DEFAULTS, flyWeight: 1 });
    Object.assign(sim.fish[0], { x: NaN, y: Infinity, angle: NaN, speed: NaN });
    sim.update(1 / 60);
    const fish = sim.fish[0];
    expect([fish.x, fish.y, fish.angle, fish.speed, fish.vx, fish.vy].every(Number.isFinite)).toBe(true);
  });
  it('changes populations and clears removed predator targets', () => {
    const sim = new Aquarium({ ...DEFAULTS });
    sim.settings.fishCount = 30; sim.settings.stations = 6; sim.settings.predators = 8; sim.applySettings();
    expect(sim.fish.length).toBe(30); expect(sim.stations.length).toBe(6); expect(sim.predators.length).toBe(8);
    sim.settings.predators = 0; sim.settings.stations = 0; sim.applySettings();
    expect(sim.predators.length + sim.stations.length).toBe(0);
  });
  it('returns only nearby grid neighbours, including across cell boundaries', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: number }>(120);
    const objects = [{ x: 119, y: 120, id: 1 }, { x: 121, y: 120, id: 2 }, { x: 240, y: 240, id: 3 }];
    grid.rebuild(objects); expect(grid.near(objects[0], 5).map(o => o.id)).toEqual([1, 2]);
  });
});
