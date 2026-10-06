import { describe, expect, it } from 'vitest';
import { AquariumGame, JOURNAL, PHRASES, readGameState, SHOP } from '../../src/game';
import { Aquarium } from '../../src/simulation';
import { DEFAULTS } from '../../src/types';

describe('aquarium notebook', () => {
  it('keeps named fish slots stable across population changes and aquarium resets', () => {
    const sim = new Aquarium({ ...DEFAULTS }); const ids = sim.fish.map(f => f.id);
    sim.settings.fishCount = 12; sim.applySettings(); sim.settings.fishCount = 24; sim.applySettings();
    expect(sim.fish.map(f => f.id)).toEqual(ids); sim.reset(); expect(sim.fish.map(f => f.id)).toEqual(ids);
  });
  it('bounds corrupt progress, filters unknown rewards and requires ownership for scenery', () => {
    const s = readGameState({ version: 1, shells: -8, found: ['meal', 'meal', '<script>'], owned: ['shell', 'bogus'], theme: 'night', plant: 'pink', rock: 'lavender', props: { shell: { on: true, position: 900 }, arch: { on: true } }, songs: [0, 0, -1, 30], friends: { '1': { name: '1234567890123456789', bond: 900, rewarded: 10 }, '__proto__': {} }, visits: { crab: NaN, glow: -1 } });
    expect(s.shells).toBe(0); expect(s.found).toEqual(['meal']); expect(s.owned).toEqual(['shell']);
    expect([s.theme, s.plant, s.rock]).toEqual(['sea', 'green', 'moss']); expect(s.props.shell).toEqual({ on: true, position: 2 }); expect(s.props.arch).toBeUndefined();
    expect(s.songs).toEqual([0]); expect(s.friends[1]).toEqual({ name: '1234567890123456', bond: 100, rewarded: 3 }); expect(s.visits).toEqual({ crab: 0, chest: 0, glow: 0 });
    expect(readGameState(null).shells).toBe(8); expect(readGameState({ version: 99, shells: 10000 }).shells).toBe(8);
  });
  it('routes curious fish to the cursor but releases frightened fish and prioritizes a friend call', () => {
    const g = new AquariumGame(), sim = new Aquarium({ ...DEFAULTS, predators: 0 });
    const f = sim.fish[0]; f.x = 200; f.y = 180; f.fear = 0; f.startleLeft = f.startleRight = 0;
    g.movePointer({ x: 300, y: 180 }); expect(g.pointer).toBeNull(); g.toggleFollow(); g.movePointer({ x: 300, y: 180 });
    expect(g.followTarget(f)).toEqual({ x: 300, y: 180 });
    f.startleLeft = 1; expect(g.followTarget(f)).toBeNull(); f.startleLeft = 0;
    f.fear = .5; expect(g.followTarget(f)).toBeNull(); f.fear = 0;
    g.movePointer({ x: 700, y: 180 }); expect(g.followTarget(f)).toBeNull();
    g.state.friends[f.id] = { name: '', bond: 8, rewarded: 1 }; expect(g.followTarget(f)).not.toBeNull();
    g.callFriends({ x: 250, y: 200 }); expect(g.followTarget(f)).toBe(g.call);
    g.startPhrase(0); expect(g.followTarget(f)).toBeNull(); g.stopPhrase(); g.call = null;
    g.clearPointer(); expect(g.followTarget(f)).toBeNull();
  });
  it('saves follow preference without keeping a stale or invalid cursor position', () => {
    const g = new AquariumGame(); g.toggleFollow(); g.movePointer({ x: 300, y: 180 });
    g.movePointer({ x: NaN, y: 30 }); expect(g.pointer).toEqual({ x: 300, y: 180 });
    const loaded = new AquariumGame(JSON.parse(JSON.stringify(g.state)));
    expect(loaded.state.followPointer).toBe(true); expect(loaded.pointer).toBeNull();
    expect(readGameState({ version: 1, followPointer: 'true' }).followPointer).toBe(false);
    g.toggleFollow(); expect(g.pointer).toBeNull(); expect(g.state.followPointer).toBe(false);
  });
  it('awards each discovery once and never accepts an unknown discovery', () => {
    const g = new AquariumGame();
    expect(g.discover('meal')).toBe(true); expect(g.discover('meal')).toBe(false); expect(g.discover('bogus')).toBe(false);
    expect(g.state.shells).toBe(12); expect(g.state.found).toEqual(['meal']);
    const loaded = new AquariumGame(JSON.parse(JSON.stringify(g.state))); loaded.discover('meal'); expect(loaded.state.shells).toBe(12);
  });
  it('gentle touches have a cooldown and friendship milestones are rewarded only once', () => {
    const g = new AquariumGame(); expect(g.pet(1)).toBe(false); g.toggleGentle();
    for (let i = 0; i < 4; i++) { expect(g.pet(1)).toBe(true); expect(g.pet(1)).toBe(false); g.time += 2; }
    expect(g.friend(1).bond).toBe(8); expect(g.state.shells).toBe(15); expect(g.state.found).toContain('friend');
    const loaded = new AquariumGame(g.state); loaded.toggleGentle(); loaded.toggleGentle(); loaded.pet(1);
    expect(loaded.friend(1).bond).toBe(10); expect(loaded.state.shells).toBe(15);
    g.name(1, '  ぽろん  '); expect(g.friend(1).name).toBe('ぽろん'); expect(g.friend(2).bond).toBe(0);
  });
  it('only actual eating increases friendship and meal gains cannot be spammed', () => {
    const sim = new Aquarium({ ...DEFAULTS, flyWeight: 0, predators: 0, stations: 0 }); const g = new AquariumGame();
    sim.onEat = f => g.meal(f); const f = sim.fish[0]; f.x = 150; f.y = 150; f.speed = 0;
    sim.feed(f.x, false, f.y, 1); expect(g.friend(f.id).bond).toBe(0);
    sim.senseAndThink(); sim.update(.02); expect(g.friend(f.id).bond).toBe(1); expect(g.state.found).toContain('meal');
    g.meal(f); expect(g.friend(f.id).bond).toBe(1); g.time += 5; g.meal(f); expect(g.friend(f.id).bond).toBe(2);
  });
  it('a companion stimulus steers friendly fish and enemies retain priority', () => {
    const sim = new Aquarium({ ...DEFAULTS, flyWeight: 0, predators: 0, stations: 0 });
    const f = sim.fish[0], point = { x: 300, y: 180 }; f.x = 220; f.y = 180; f.angle = Math.PI;
    sim.companion = fish => fish === f ? point : null; sim.senseAndThink();
    expect(f.target).toBe(point); expect(f.sensory.foodDistance).toBeLessThan(1);
    expect(f.program.turnLeft + f.program.turnRight).toBeGreaterThan(.5);
    sim.settings.predators = 1; sim.applySettings(); sim.predators[0].x = 260; sim.predators[0].y = 180; sim.senseAndThink();
    expect(f.target).toBe(sim.predators[0]);
  });
  it('finds a sustained school, slow swimming, station gathering and a called friend', () => {
    const g = new AquariumGame(), sim = new Aquarium({ ...DEFAULTS, predators: 0, stations: 0 });
    const fish = sim.fish.slice(0, 3);
    fish.forEach((f, i) => { f.x = 200 + i * 20; f.y = 150; f.angle = .1; f.speed = 30; f.fear = 0; });
    g.update(.5, fish, [{ x: 220, y: 160 }], 12);
    expect(g.state.found).toContain('station'); expect(g.state.found).not.toContain('school');
    for (let i = 0; i < 5; i++) g.update(.5, fish, [], 12);
    expect(g.state.found).toContain('school'); expect(g.state.found).toContain('rest');
    g.state.friends[fish[0].id] = { name: '', bond: 8, rewarded: 1 }; g.callFriends(fish[0]); g.update(.5, fish, [], 12);
    expect(g.state.found).toContain('follow'); fish[0].fear = .6; fish[0].sensory.enemyDistance = .2; fish[0].action.accelerate = .8;
    g.update(.5, fish, [], 12); expect(g.state.found).toContain('escape');
  });
  it('a wrong note resets a phrase; completion rewards once, also after reload', () => {
    const g = new AquariumGame(); g.startPhrase(0); expect(g.note(1)).toBe('next'); expect(g.note(2)).toBe('retry'); expect(g.phrase?.step).toBe(0);
    expect(g.note(11)).toBe('next'); expect(g.note(3)).toBe('next'); expect(g.note(5)).toBe('complete');
    expect(g.state.shells).toBe(17); expect(g.phrase).toBeNull(); expect(g.danceSerial).toBe(1);
    const loaded = new AquariumGame(g.state); loaded.startPhrase(0); for (const id of [1, 3, 5]) loaded.note(id); expect(loaded.state.shells).toBe(17);
    for (const [index, p] of PHRASES.entries()) { loaded.startPhrase(index); for (const n of p.notes) loaded.note(n + 1); }
    expect(loaded.state.songs).toEqual([0, 1, 2]); expect(loaded.state.shells).toBe(27);
  });
  it('purchases are atomic, ownership persists, and stored props can be moved or hidden', () => {
    const g = new AquariumGame(); expect(g.buy('arch')).toBe(false); expect(g.state.shells).toBe(8); expect(g.state.owned).toEqual([]);
    expect(g.buy('shell')).toBe(true); expect(g.state.shells).toBe(6); expect(g.state.props.shell).toEqual({ on: true, position: 1 });
    g.buy('shell'); expect(g.state.shells).toBe(6); g.prop('shell', false, 2); g.buy('shell'); expect(g.state.props.shell).toEqual({ on: true, position: 2 });
    g.prop('arch', true, 0); expect(g.state.props.arch).toBeUndefined();
    g.baseLook(); expect(g.state.props.shell?.on).toBe(false); expect(g.state.owned).toContain('shell');
    const loaded = new AquariumGame(g.state); expect(loaded.state.props.shell?.position).toBe(2); expect(loaded.buy('bogus')).toBe(false);
  });
  it('all scenery selections survive loading while the default look retains ownership', () => {
    const g = new AquariumGame(); g.state.shells = 100;
    for (const item of SHOP) expect(g.buy(item.id)).toBe(true);
    const loaded = new AquariumGame(g.state);
    expect([loaded.state.theme, loaded.state.plant, loaded.state.rock]).toEqual(['night', 'pink', 'lavender']);
    expect(loaded.state.owned).toHaveLength(SHOP.length); loaded.baseLook(); expect(loaded.state.owned).toHaveLength(SHOP.length);
    expect(new Set(JOURNAL.map(j => j.id)).size).toBe(JOURNAL.length);
  });
  it('visitors use active time, expire without a penalty and can be collected only once', () => {
    const g = new AquariumGame(); for (let i = 0; i < 44; i++) g.update(1, [], [], 12);
    expect(g.visitor).toBeNull(); g.update(0, [], [], 12); expect(g.time).toBe(44);
    g.update(1, [], [], 12); expect(g.visitor?.kind).toBe('crab');
    const point = g.visitorPoint(640, 900)!; expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(640); expect(point.y).toBeLessThan(900);
    expect(g.collectVisitor()).toBe(true); expect(g.collectVisitor()).toBe(false); expect(g.state.shells).toBe(12); expect(g.state.visits.crab).toBe(1);
    for (let i = 0; i < 150; i++) g.update(1, [], [], 12); expect(g.visitor?.kind).toBe('chest');
    for (let i = 0; i < 91; i++) g.update(1, [], [], 12); expect(g.visitor).toBeNull(); expect(g.state.shells).toBe(12);
  });
  it('glowing visitors appear at night but never in the daytime rotation', () => {
    const night = new AquariumGame(), day = new AquariumGame();
    for (let i = 0; i < 45; i++) { night.update(1, [], [], 20); day.update(1, [], [], 12); }
    night.collectVisitor(); day.collectVisitor();
    for (let i = 0; i < 150; i++) { night.update(1, [], [], 20); day.update(1, [], [], 12); }
    expect(night.visitor?.kind).toBe('glow'); expect(day.visitor?.kind).toBe('chest');
  });
});
