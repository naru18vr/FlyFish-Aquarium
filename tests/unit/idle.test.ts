import { describe, expect, it } from 'vitest';
import { IdleAquarium, OFFLINE_CAP, readIdleState } from '../../src/idle';
import { AquariumGame } from '../../src/game';
import { Aquarium } from '../../src/simulation';
import { DEFAULTS } from '../../src/types';

const NOW = 1770000000000;
function setup() {
  const idle = new IdleAquarium(undefined, NOW), game = new AquariumGame();
  idle.onGrant = grant => game.receiveIdle(grant);
  return { idle, game };
}
describe('idle aquarium', () => {
  it('collects every ready reward once, keeps unfinished journeys and persists the result', () => {
    const { idle, game } = setup();
    idle.state.shells=4; idle.state.growth=1200; idle.state.fairy=true; idle.state.level=3; idle.state.world.crab.pending=3;
    idle.state.journey={ fishId:1, species:'goldfish', name:'ぽろん', route:0, elapsed:3599, recorded:false };
    expect(idle.rewards.shells).toBe(19); expect(idle.claimAll(NOW)).toBe(19);
    expect(game.state.shells).toBe(27); expect(game.state.owned).toContain('pink'); expect(idle.state.journey).not.toBeNull();
    expect(idle.claimAll(NOW)).toBe(0); expect(game.state.shells).toBe(27);
    idle.state.journey!.elapsed=3600; expect(idle.rewards.shells).toBe(12); expect(idle.claimAll(NOW)).toBe(12);
    expect(game.state.shells).toBe(39); expect(idle.state.photos).toHaveLength(1); expect(idle.state.journey).toBeNull();
    const restored=new IdleAquarium(JSON.parse(JSON.stringify(idle.state)), NOW);
    restored.onGrant=grant=>game.receiveIdle(grant); expect(restored.claimAll(NOW)).toBe(0); expect(game.state.shells).toBe(39);
  });
  it('validates saved clocks, collections, species and bounded progress', () => {
    const state = readIdleState({ version: 1, lastSeen: NOW + 999999, total: NaN, shells: 1e9, growth: Infinity, garden: 8, level: 9,
      eggs: [{ id: 1, species: 'bad', born: -100 }, { id: 1 }], young: [{ id: 2, born: Infinity }], nextEgg: -9,
      photos: [{ name: 'x'.repeat(100), species: 'fake' }], souvenirs: ['bogus', '星砂の小瓶', '星砂の小瓶'], grants: [{ id: 'bogus', shells: 10000 }] }, NOW);
    expect(state.lastSeen).toBe(NOW); expect(state.shells).toBe(200); expect(state.total).toBe(0); expect(state.growth).toBe(0);
    expect(state.level).toBe(4); expect(state.garden).toBe(2); expect(state.eggs).toHaveLength(1); expect(state.eggs[0].species).toBe('goldfish');
    expect(state.photos[0].name).toHaveLength(16); expect(state.souvenirs).toEqual(['星砂の小瓶']); expect(state.grants).toEqual([]);
    expect(readIdleState({ version: 99, shells: 999 }, NOW).shells).toBe(0);
  });
  it('caps each offline gap at eight hours and cannot replay the same interval', () => {
    const { idle } = setup(); expect(idle.tick(NOW + 24 * 3600 * 1000, 14)).toBe(OFFLINE_CAP);
    expect(idle.state.total).toBe(OFFLINE_CAP); expect(idle.state.shells).toBe(96);
    const loaded = new IdleAquarium(JSON.parse(JSON.stringify(idle.state)), NOW + 24 * 3600 * 1000);
    expect(loaded.tick(NOW + 24 * 3600 * 1000)).toBe(0); expect(loaded.state.shells).toBe(96);
    expect(loaded.tick(NOW)).toBe(0); expect(loaded.state.total).toBe(OFFLINE_CAP);
  });
  it('persists an unacknowledged harvest and safely replays its receipt after a crash', () => {
    const { idle, game } = setup(); idle.tick(NOW + 1200000);
    let saved: unknown; idle.onChange = () => { if (idle.state.grants.length) saved = JSON.parse(JSON.stringify(idle.state)); };
    expect(idle.harvest(NOW + 1200000)).toBe(true); expect(game.state.shells).toBe(14); expect(game.state.owned).toContain('pink');
    expect(idle.harvest()).toBe(false);
    const restored = new IdleAquarium(saved, NOW + 1200000), restoredGame = new AquariumGame(JSON.parse(JSON.stringify(game.state)));
    restored.onGrant = grant => restoredGame.receiveIdle(grant); restored.flushGrants();
    expect(restoredGame.state.shells).toBe(14); expect(restored.state.grants).toHaveLength(0);
    expect(restored.state.growth).toBe(0); expect(restored.state.blooms).toBe(1);
  });
  it('sends a friendly fish away, freezes it, resumes it on return and awards one souvenir and photo', () => {
    const { idle, game } = setup(), sim = new Aquarium({ ...DEFAULTS, fishCount: 1, predators: 0, stations: 0 });
    const f = sim.fish[0]; sim.isAway = fish => idle.isAway(fish.id);
    expect(idle.startJourney(f, 'ぽろん', 7, 0, NOW)).toBe(false);
    expect(idle.startJourney(f, 'ぽろん', 8, 1, NOW)).toBe(false);
    expect(idle.startJourney(f, 'ぽろん', 8, 0, NOW)).toBe(true); expect(idle.startJourney(f, '', 8, 0)).toBe(false);
    const before = { x: f.x, y: f.y }; sim.update(.02); expect({ x: f.x, y: f.y }).toEqual(before); expect(sim.pick(f)).toBeNull();
    expect(idle.receiveJourney()).toBe(false); idle.tick(NOW + 3600000);
    expect(idle.isAway(f.id)).toBe(false); expect(sim.pick(f)?.id).toBe(f.id);
    expect(idle.receiveJourney(NOW + 3600000)).toBe(true); expect(idle.receiveJourney()).toBe(false);
    expect(game.state.shells).toBe(20); expect(idle.state.photos).toHaveLength(1); expect(idle.state.photos[0].name).toBe('ぽろん');
    expect(idle.state.souvenirs).toEqual(['真珠のかけら']);
  });
  it('orders egg births and hatches through offline time and keeps a bounded nursery after reload', () => {
    const { idle } = setup(); idle.tick(NOW + 1200000); expect(idle.state.eggs).toHaveLength(1); expect(idle.state.young).toHaveLength(0);
    idle.tick(NOW + 3000000); expect(idle.state.eggs).toHaveLength(0); expect(idle.state.young).toHaveLength(1);
    const loaded = new IdleAquarium(JSON.parse(JSON.stringify(idle.state)), NOW + 3000000);
    for (let i = 1; i <= 4; i++) loaded.tick(NOW + 3000000 + i * OFFLINE_CAP * 1000);
    expect(loaded.state.young).toHaveLength(12); expect(loaded.state.eggs).toHaveLength(0);
    expect(new Set(loaded.state.young.map(f => f.id)).size).toBe(12);
    expect(loaded.state.diary.length).toBeLessThanOrEqual(30);
  });
  it('requires discoveries as well as time and unlocks scenery, garden types and an occasional fairy', () => {
    const { idle, game } = setup(); idle.tick(NOW + OFFLINE_CAP * 1000, 4); expect(idle.state.level).toBe(1);
    idle.tick(NOW + OFFLINE_CAP * 1000 + 1000, 5); expect(idle.state.level).toBe(2); expect(game.state.owned).toContain('sunset');
    idle.garden(2); expect(idle.state.garden).toBe(0); idle.garden(1); expect(idle.state.garden).toBe(1);
    idle.tick(NOW + OFFLINE_CAP * 1000 + 2000, 7); expect(idle.state.level).toBe(3); expect(game.state.owned).toContain('night');
    idle.tick(NOW + OFFLINE_CAP * 1000 + 1802000, 10); expect(idle.state.level).toBe(4); expect(game.state.owned).toEqual(expect.arrayContaining(['arch', 'star']));
    expect(idle.state.fairy).toBe(true); const shells = game.state.shells;
    expect(idle.greetFairy()).toBe(true); expect(idle.greetFairy()).toBe(false); expect(game.state.shells).toBe(shells + 6);
    idle.garden(2); expect(idle.state.garden).toBe(2);
  });
  it('caps collected shells and new saved aquariums use different grant identities', () => {
    const { idle, game } = setup(); for (let i = 1; i <= 3; i++) idle.tick(NOW + i * OFFLINE_CAP * 1000);
    expect(idle.state.shells).toBe(200); expect(idle.collectShells()).toBe(true); expect(idle.collectShells()).toBe(false); expect(game.state.shells).toBe(208);
    const fresh = new IdleAquarium(undefined, NOW); fresh.onGrant = grant => game.receiveIdle(grant);
    fresh.tick(NOW + 300000); fresh.collectShells(); expect(game.state.shells).toBe(209);
  });
  it('saves the feeder preference and gives actual manual meals a larger friendship bonus', () => {
    const { idle, game } = setup(); idle.toggleFeed(); expect(new IdleAquarium(idle.state, NOW).state.autoFeed).toBe(false);
    const sim = new Aquarium({ ...DEFAULTS, predators: 0, stations: 0 }), f = sim.fish[0];
    sim.onEat = (fish, manual) => game.meal(fish, manual);
    sim.feed(f.x, false, f.y, 1, true); sim.senseAndThink(); sim.update(.02); expect(game.friend(f.id).bond).toBe(2);
    game.time += 5; sim.feed(f.x, false, f.y, 1, false); sim.senseAndThink(); sim.update(.02); expect(game.friend(f.id).bond).toBe(3);
  });
});
