import { describe, expect, it } from 'vitest';
import { IdleAquarium, ROUTES } from '../../src/idle';
import { AquariumGame } from '../../src/game';
import { advanceWorld, readWorld, stage } from '../../src/idle-world';
const NOW = 1770000000000;
const fish = { id: 1, species: 'goldfish' as const };
function setup() { const idle = new IdleAquarium(undefined, NOW), game = new AquariumGame(); idle.onGrant = grant => game.receiveIdle(grant); idle.context = () => ({ fish: [{ ...fish, name: 'ぽろん' }], props: { shell: { on: true, position: 0 } } }); return { idle, game }; }
describe('growing idle world', () => {
  it('migrates old fish and maps without losing the existing wallet or nursery', () => {
    const idle = new IdleAquarium({ version: 1, total: 18000, lastSeen: NOW, young: [{ id: 9, species: 'tetra', born: 3000 }], photos: [{ place: ROUTES[0].name }, { place: ROUTES[1].name }] }, NOW);
    expect(idle.state.world.map.slice(0, 2)).toEqual([1, 1]); idle.tick(NOW + 1000);
    expect(idle.state.young[0].id).toBe(9); expect(idle.state.world.children[9].stage).toBe(2); expect(idle.state.world.rooms[0].look).toBeNull();
  });
  it('reveals growth, personality and stable rare colors and retains discoveries across reload', () => {
    const world = readWorld(null, 0);
    for (let id = 1; id <= 60; id++) advanceWorld(world, [{ id, species: 'goldfish', born: 0 }], 14400, 14400, NOW, 'test00', { fish: [], props: {} });
    expect(world.colors).toEqual(expect.arrayContaining(['goldfish:0', 'goldfish:1', 'goldfish:2', 'goldfish:3']));
    expect(world.children[60].stage).toBe(2); expect(stage(3599)).toBe(0); expect(stage(3600)).toBe(1); expect(stage(14400)).toBe(2);
    const saved = readWorld(JSON.parse(JSON.stringify(world)), 14400); expect(saved.children).toEqual(world.children); expect(saved.colors).toEqual(world.colors);
  });
  it('keeps named grown fish at the hotel and restores them without duplication', () => {
    const { idle } = setup(); idle.tick(NOW + 8 * 3600000, 14);
    const f = idle.state.young[0]; expect(idle.nameChild(f.id, 'ちびぽろん')).toBe(true);
    expect(idle.moveChild(f.id, 2)).toBe(true); expect(idle.hotelChild(f.id)).toBe(true); expect(idle.hotelChild(f.id)).toBe(false);
    const loaded = new IdleAquarium(JSON.parse(JSON.stringify(idle.state)), NOW + 8 * 3600000);
    expect(loaded.state.world.hotel[0].child.name).toBe('ちびぽろん'); expect(loaded.restoreChild(f.id)).toBe(true); expect(loaded.restoreChild(f.id)).toBe(false);
    expect(loaded.state.world.children[f.id].room).toBe(2); expect(loaded.state.young.filter(a => a.id === f.id)).toHaveLength(1);
    expect(loaded.hotelChild(loaded.state.young.find(a => loaded.state.total - a.born < 14400)!.id)).toBe(false);
  });
  it('bounds shop rewards, checks greeting time and safely claims each reward once', () => {
    const { idle, game } = setup(); expect(idle.greetCrab()).toBe(true); expect(idle.greetCrab()).toBe(false);
    idle.tick(NOW + 8 * 3600000); expect(idle.state.world.crab.pending).toBe(16);
    const before = game.state.shells; expect(idle.collectCrab()).toBe(true); expect(game.state.shells).toBe(before + 16); expect(idle.collectCrab()).toBe(false);
    idle.state.world.crab.bond = 15; for (let i = 1; i <= 4; i++) idle.tick(NOW + (8 + i * 8) * 3600000);
    expect(idle.state.world.crab.pending).toBe(100); const copy = new IdleAquarium(idle.state, NOW + 40 * 3600000); expect(copy.state.world.crab.bond).toBe(15); expect(copy.state.world.crab.pending).toBe(100);
  });
  it('unlocks long routes from claimed discoveries and saves completed maps and photos', () => {
    const { idle } = setup(); idle.state.level = 4;
    expect(idle.startJourney(fish, 'ぽろん', 60, 2, NOW)).toBe(false);
    let clock = NOW;
    for (let route = 0; route < 4; route++) {
      expect(idle.routeAvailable(route)).toBe(true); expect(idle.startJourney(fish, 'ぽろん', 60, route, clock)).toBe(true);
      clock += ROUTES[route].seconds * 1000; idle.tick(clock, 14); expect(idle.receiveJourney(clock)).toBe(true); expect(idle.receiveJourney(clock)).toBe(false);
    }
    expect(idle.state.world.map).toEqual([1, 1, 1, 1]); expect(idle.state.photos).toHaveLength(4);
    expect(new IdleAquarium(idle.state, clock).state.world.map).toEqual([1, 1, 1, 1]);
  });
  it('maintains independent room decorations and rejects locked or invalid moves', () => {
    const { idle } = setup(), look = { theme: 'sea' as const, plant: 'green' as const, rock: 'moss' as const, props: { shell: { on: true, position: 0 } } };
    idle.captureLook(look); look.props.shell.position = 2; expect(idle.state.world.rooms[0].look?.props.shell?.position).toBe(0);
    expect(idle.selectRoom(1)).toBe(false); idle.state.level = 3; expect(idle.selectRoom(1)).toBe(true);
    idle.captureLook({ ...look, theme: 'sunset' }); expect(idle.state.world.rooms[0].look?.theme).toBe('sea'); expect(idle.state.world.rooms[1].look?.theme).toBe('sunset');
    expect(idle.selectRoom(NaN)).toBe(false); expect(idle.selectRoom(9)).toBe(false); idle.nameRoom(1, '夕焼けのおうち');
    const loaded = new IdleAquarium(idle.state, NOW); expect(loaded.state.world.room).toBe(1); expect(loaded.state.world.rooms[1].name).toBe('夕焼けのおうち');
  });
  it('records named favorite places and bounded readable mail and sanitizes corrupt world data', () => {
    const { idle } = setup(); idle.tick(NOW + 3600000, 14);
    expect(idle.state.world.favorites[1].affection).toBeGreaterThanOrEqual(2); expect(idle.state.world.letters.some(l => l.name === 'ぽろん')).toBe(true);
    for (let i = 2; i < 50; i++) idle.tick(NOW + i * 3600000, 14);
    expect(idle.state.world.letters.length).toBeLessThanOrEqual(30); idle.readLetters(); expect(idle.state.world.read).toBe(idle.state.world.serial);
    const broken = readWorld({ room: 99, colors: ['goldfish:1', 'goldfish:1', 'fake:9'], crab: { pending: Infinity, bond: 900 }, children: { '1': { name: 'x'.repeat(90), shade: 999, favorite: 'toString', room: 99 } } }, 0);
    expect(broken.room).toBe(2); expect(broken.colors).toEqual(['goldfish:1']); expect(broken.crab.pending).toBe(0); expect(broken.children[1].name).toHaveLength(16); expect(broken.children[1].favorite).toBe('seaweed');
  });
});
