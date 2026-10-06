import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BASE_HEIGHT, BASE_WIDTH, HEIGHT, random, safePosition, WIDTH } from './math';
import type { Aquarium } from './simulation';
import type { Fish, Point, Rock } from './types';
import { FISH_PROFILES, FISH_SPECIES, PREDATOR_KINDS, PREDATOR_PROFILES, type FishSpecies, type PredatorKind } from './species';
import { AquariumGame, degreeOf, PHRASES, type VisitorKind } from './game';
import type { IdleAquarium, YoungFish } from './idle';
import { stage } from './idle-world';

const palettes = [
  ['#efb969', '#ffd78d', '#ca8653'], ['#e4e4b5', '#fff4ce', '#afb98b'],
  ['#f09c97', '#ffc5ac', '#be717e'], ['#84cbb1', '#b2ead0', '#539c94'],
  ['#b8aad7', '#ded0f2', '#8c86bb'],
];
function pixelTexture(pattern: string[], colors: Record<string, string>, frame = 0, eating = false) {
  const canvas = document.createElement('canvas'); canvas.width = Math.max(...pattern.map(row => row.length)) + 2; canvas.height = pattern.length + 2;
  const context = canvas.getContext('2d')!;
  let eye = { x: canvas.width - 5, y: Math.floor(canvas.height / 2) };
  pattern.forEach((line, y) => [...line].forEach((pixel, x) => {
    if (colors[pixel]) { context.fillStyle = colors[pixel]; context.fillRect(1 + x + (x < 4 && frame === 1 ? 1 : 0), y + 1, 1, 1); }
    if (pixel === 'e') eye = { x: x + 1, y: y + 1 };
  }));
  if (eating) { context.fillStyle = '#264d44'; context.fillRect(Math.min(canvas.width - 3, eye.x + 3), eye.y + 2, 2, 2); }
  const texture = Texture.from(canvas); texture.source.scaleMode = 'nearest'; return texture;
}
function fishTexture(species: FishSpecies, palette: string[], frame: number, eating = false) {
  return pixelTexture(FISH_PROFILES[species].pattern, { a: palette[2], b: palette[0], c: palette[1], d: '#fff9df', w: '#fffce7', e: '#173c3d' }, frame, eating);
}
export class AquariumRenderer {
  game?: AquariumGame;
  idle?: IdleAquarium;
  private idleGarden = new Graphics();
  private youngSprites = new Map<number, Sprite>();
  private youngDarts = new Map<number, { x: number; y: number; left: number }>();
  private youngTextures = new Map<FishSpecies, Texture[][]>();
  app = new Application();
  private background = new Container(); private plants = new Container(); private scenery = new Container(); private creatures = new Container(); private foreground = new Container();
  private food = new Graphics(); private bubbles = new Graphics(); private selection = new Graphics(); private ripples = new Graphics();
  private fishSprites = new Map<number, Sprite>(); private predatorSprites = new Map<number, Sprite>();
  private textures = new Map<FishSpecies, Texture[][]>(); private predatorTextures = new Map<PredatorKind, Texture>();
  private plantSprites: { graphics: Graphics; x: number; phase: number }[] = [];
  private bubblePoints: { x: number; y: number; speed: number; r: number; phase: number }[] = [];
  private ripple: (Point & { age: number; kind: string; midi?: number })[] = [];
  private settingsKey = '';
  private initialized = false;
  private props = new Graphics(); private visitorSprite = new Sprite(); private visitorTextures = new Map<VisitorKind, Texture>();
  private themeKey = ''; private propKey = ''; private plantKey = '';
  private visualTime = 0; private danceEnd = 0; private lastDance = 0;
  async init(host: HTMLElement) {
    await this.app.init({ width: WIDTH, height: HEIGHT, antialias: false, background: '#143f46', resolution: 1, preference: 'webgl' });
    // A user can enter aquarium mode while the GPU is still initializing.
    if (this.app.renderer.width !== WIDTH || this.app.renderer.height !== HEIGHT) this.app.renderer.resize(WIDTH, HEIGHT);
    host.prepend(this.app.canvas);
    this.app.canvas.setAttribute('aria-label', '泳ぐ魚の水槽。空間をクリックで餌、魚をクリックで刺激。Shift＋クリックで個体情報。');
    this.app.canvas.setAttribute('role', 'img');
    this.app.canvas.tabIndex = 0;
    this.app.canvas.setAttribute('aria-describedby', 'keyboard-help');
    for (const species of FISH_SPECIES) this.textures.set(species, palettes.map(palette => [fishTexture(species, palette, 0), fishTexture(species, palette, 1), fishTexture(species, palette, 0, true)]));
    for (const species of FISH_SPECIES) this.youngTextures.set(species, [palettes[0], ['#d4d1ef', '#f3f0ff', '#a6a3c1'], ['#f6b1bd', '#ffe2cc', '#c87689'], ['#9ed8bd', '#ddf4d3', '#5a9e90']].map(p => [fishTexture(species, p, 0), fishTexture(species, p, 1)]));
    for (const kind of PREDATOR_KINDS) this.predatorTextures.set(kind, pixelTexture(PREDATOR_PROFILES[kind].pattern, PREDATOR_PROFILES[kind].colors));
    this.visitorTextures.set('crab', pixelTexture(['a.......a', 'aa.....aa', '.abbbba.', '..bebeb..', '.abbbba.', 'a.a.a.a.a'], { a: '#c57b78', b: '#f2afa0', e: '#23484a' }));
    this.visitorTextures.set('chest', pixelTexture(['.aaaaaaa.', 'abbbbb b a'.replaceAll(' ', ''), 'accccccca', 'aaadddaaa', 'accdddcca', 'accccccca', '.aaaaaaa.'], { a: '#9b7b57', b: '#e4b676', c: '#c99463', d: '#ffe1a0' }));
    this.visitorTextures.set('glow', pixelTexture(['....aaa....', '..abbbba...', 'aabbbebba..', 'aabbbbbbba.', '..abbba....', '....aa.....'], { a: '#89aecc', b: '#d4f6bc', e: '#284667' }));
    this.app.stage.addChild(this.background, this.plants, this.scenery, this.creatures, this.foreground);
    this.foreground.addChild(this.idleGarden, this.food, this.bubbles, this.selection, this.ripples);
    this.creatures.addChild(this.visitorSprite); this.visitorSprite.anchor.set(.5); this.visitorSprite.visible = false;
    this.scenery.addChild(this.props);
    this.drawBackground(); this.drawPlants();
    const rng = random(42);
    this.bubblePoints = Array.from({ length: 36 }, () => ({ x: 45 + rng() * (WIDTH - 90), y: rng() * HEIGHT, r: 2 + Math.floor(rng() * 3), speed: 15 + rng() * 27, phase: rng() * 6.28 }));
    // Simulation owns the animation clock, so there is only one RAF loop.
    this.app.stop();
    this.initialized = true;
  }
  resize(sim: Aquarium) {
    if (!this.initialized) return;
    const oldWidth = this.app.renderer.width, oldHeight = this.app.renderer.height;
    this.app.renderer.resize(WIDTH, HEIGHT);
    this.background.removeChildren().forEach(child => child.destroy());
    this.plants.removeChildren().forEach(child => child.destroy()); this.plantSprites = [];
    this.drawBackground(); this.drawPlants(); this.settingsKey = ''; this.propKey = '';
    for (const bubble of this.bubblePoints) { bubble.x *= WIDTH / oldWidth; bubble.y *= HEIGHT / oldHeight; }
    this.ripple = []; this.youngDarts.clear();
    // Resizing clears the drawing buffer; draw now even while paused.
    this.render(sim, 0, 0);
  }
  private drawBackground() {
    const g = new Graphics();
    const ground = HEIGHT - 70, xScale = WIDTH / BASE_WIDTH;
    const theme = this.game?.state.theme;
    const bands = theme === 'night' ? ['#414f7b', '#3c4a75', '#37456e', '#334168', '#303e61', '#2c385b', '#293455', '#25304f', '#232c49', '#202a44'] : theme === 'sunset' ? ['#856d89', '#7d6984', '#75647e', '#6c6077', '#645b71', '#5d566b', '#555265', '#4e4d60', '#47495a', '#424655'] : ['#23666a', '#226469', '#205f65', '#1d595f', '#1a535b', '#184d55', '#16474f', '#15444b', '#143f46', '#143c43'];
    bands.forEach((color, i) => g.rect(0, i * HEIGHT / 10, WIDTH, HEIGHT / 10 + 1).fill(color));
    g.poly([110 * xScale, 20, 206 * xScale, 20, 480 * xScale, ground - 10, 252 * xScale, ground - 10]).fill({ color: '#c4efc6', alpha: .032 });
    g.poly([425 * xScale, 20, 488 * xScale, 20, 770 * xScale, ground - 10, 620 * xScale, ground - 10]).fill({ color: '#c4efc6', alpha: .025 });
    g.poly([890 * xScale, 20, 943 * xScale, 20, 1190 * xScale, ground - 10, 1040 * xScale, ground - 10]).fill({ color: '#c4efc6', alpha: .025 });
    g.rect(0, 0, WIDTH, 10).fill('#629b8e'); g.rect(0, 10, WIDTH, 8).fill('#477f79');
    const rng = random(1701);
    for (let i = 0; i < 150; i++) g.rect(Math.floor(rng() * WIDTH / 4) * 4, Math.floor(25 + rng() * (HEIGHT - 120)), 2, 2).fill({ color: '#a6cfc2', alpha: .09 });
    for (let i = 0; i < 60; i++) g.rect(i * WIDTH / 60, 22 + (i % 3) * 3, 15, 2).fill({ color: '#bce4c8', alpha: .2 });
    if (theme === 'night') for (let i = 0; i < 18; i++) { const x = rng() * WIDTH, y = 40 + rng() * HEIGHT * .35; g.rect(x - 3, y, 8, 2).rect(x, y - 3, 2, 8).fill({ color: '#e8e6bd', alpha: .45 }); }
    // Far-away vegetation and soft rocky silhouettes add depth.
    for (let i = 0; i < 18; i++) {
      const x = rng() * WIDTH, h = 60 + rng() * 190;
      g.poly([x - 13, ground, x - 9, ground - h * .6, x + 2, ground - h, x + 12, ground - h * .4, x + 17, ground]).fill({ color: '#35716b', alpha: .22 });
    }
    g.rect(0, ground, WIDTH, 70).fill('#a4b190'); g.rect(0, ground, WIDTH, 9).fill('#c0c5a1'); g.rect(0, ground + 26, WIDTH, 44).fill('#909f83'); g.rect(0, ground + 57, WIDTH, 13).fill('#738d79');
    for (let i = 0; i < 320; i++) {
      const x = Math.floor(rng() * WIDTH / 4) * 4, y = Math.floor((ground + 5 + rng() * 60) / 4) * 4;
      g.rect(x, y, 3 + Math.floor(rng() * 3) * 2, 2).fill(rng() > .5 ? '#c1c5a1' : '#81997f');
    }
    for (const [x, y] of [[125, 655], [405, 660], [735, 655], [977, 658], [540, 663]]) {
      g.rect(x * xScale, ground + y - 650, 18, 6).fill('#708f80'); g.rect(x * xScale + 3, ground + y - 653, 12, 3).fill('#92aa91');
    }
    this.background.addChild(g);
  }
  private drawPlants() {
    const locations = [{ x: 55, h: 150 }, { x: 88, h: 218 }, { x: 131, h: 108 }, { x: 204, h: 90 }, { x: 593, h: 92 }, { x: 630, h: 147 }, { x: 1028, h: 180 }, { x: 1070, h: 113 }, { x: 1137, h: 246 }, { x: 1171, h: 175 }];
    locations.forEach(({ x, h }, i) => {
      const g = new Graphics();
      const pink = this.game?.state.plant === 'pink';
      const colors = pink ? ['#bb8b9e', '#d8a0b0', '#e5b2bb', '#ad7f98'] : ['#559b7e', '#6cad82', '#79b18a', '#438879'];
      g.rect(-3, -h, 6, h).fill(pink ? '#9c7990' : '#407b69');
      for (let j = 0; j < h / 20; j++) {
        const side = j % 2 === 0 ? -1 : 1, y = -15 - j * 20, leaf = 12 + (j % 3) * 5;
        g.rect(side < 0 ? -leaf : 3, y - 7, leaf, 9).fill(colors[(i + j) % colors.length]);
        g.rect(side < 0 ? -leaf - 3 : leaf - 2, y - 12, 7, 7).fill(colors[(i + j + 1) % colors.length]);
      }
      g.rect(-10, -7, 20, 7).fill('#42725f'); g.position.set(x * WIDTH / BASE_WIDTH, HEIGHT - 70);
      this.plants.addChild(g); this.plantSprites.push({ graphics: g, x, phase: i });
    });
    // Small pixel coral accents.
    for (const [x, color] of [[450, '#b88e86'], [967, '#c0a37c'], [171, '#8eaba0']] as const) {
      const g = new Graphics();
      g.rect(x, 608, 7, 44).fill(color); g.rect(x - 19, 621, 20, 6).fill(color); g.rect(x - 19, 608, 6, 18).fill(color);
      g.rect(x + 5, 631, 19, 6).fill(color); g.rect(x + 19, 615, 6, 20).fill(color); g.rect(x - 4, 604, 14, 6).fill(color);
      g.position.set(x * (WIDTH / BASE_WIDTH - 1), HEIGHT - BASE_HEIGHT);
      this.plants.addChild(g);
    }
  }
  private drawScenery(sim: Aquarium) {
    this.scenery.removeChildren().forEach(child => { if (child !== this.props) child.destroy(); });
    const g = new Graphics();
    if (sim.settings.rocks) for (const rock of sim.rocks) {
      const { x, y, r } = rock;
      g.ellipse(x, y + r * .77, r * 1.04, 8).fill({ color: '#113c3f', alpha: .4 });
      g.poly([x - r, y + r * .35, x - r, y - r * .18, x - r * .6, y - r * .72, x - r * .16, y - r * .88, x + r * .48, y - r * .67, x + r * .84, y - r * .15, x + r * .88, y + r * .42, x + r * .42, y + r * .72, x - r * .52, y + r * .7]).fill('#617e79');
      g.poly([x - r * .85, y - r * .18, x - r * .5, y - r * .59, x - r * .12, y - r * .7, x + r * .4, y - r * .52, x + r * .56, y - r * .21, x - r * .24, y - r * .08]).fill('#80988a');
      g.rect(x - r * .37, y + 9, r * .52, 7).fill('#57736f');
      g.rect(x + r * .25, y - 5, r * .31, 7).fill('#93a18d');
      g.rect(x - r * .62, y + r * .49, r * .7, 6).fill('#477568');
    }
    if (this.game?.state.rock === 'lavender') g.tint = '#d4bceb';
    this.scenery.addChild(g, this.props);
    for (const s of sim.stations) {
      const station = new Graphics(), scale = sim.environmentScale;
      station.ellipse(0, 651, 31, 6).fill({ color: '#143c43', alpha: .3 });
      station.rect(-26, 633, 52, 13).fill('#5a9284'); station.rect(-20, 639, 40, 12).fill('#407469');
      station.rect(-18, 623, 36, 10).fill('#84b59a'); station.rect(-11, 627, 22, 6).fill('#204e4d');
      station.rect(-12, 614, 24, 9).fill('#b1c99e'); station.rect(-6, 617, 12, 5).fill('#527c68');
      station.rect(-26, 648, 52, 3).fill('#94b695');
      station.scale.set(scale); station.position.set(s.x, HEIGHT - 70 - 650 * scale); this.scenery.addChild(station);
    }
  }
  youngAt(point: Point) {
    let best: YoungFish | undefined;
    let near = 24;
    for (const f of this.idle?.state.young ?? []) {
      const sprite = this.youngSprites.get(f.id); if (!sprite?.visible) continue;
      const distance = Math.hypot(sprite.x - point.x, sprite.y - point.y);
      if (distance < near) { best = f; near = distance; }
    }
    return best;
  }
  youngPositions() { return (this.idle?.state.young ?? []).flatMap(f => { const sprite = this.youngSprites.get(f.id); return sprite?.visible ? [{ id: f.id, x: sprite.x, y: sprite.y }] : []; }); }
  scareYoung(id: number, point: Point) {
    const sprite = this.youngSprites.get(id), fish = this.idle?.state.young.find(f => f.id === id);
    if (!sprite || !fish) return;
    const angle = Math.hypot(sprite.x - point.x, sprite.y - point.y) > 1 ? Math.atan2(sprite.y - point.y, sprite.x - point.x) : (id % 2 ? -.7 : -2.4);
    const speed = 250 * FISH_PROFILES[fish.species].speed;
    this.youngDarts.set(id, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, left: .5 });
  }
  private drawIdle(time: number, dt: number, food: Point[], rocks: Rock[]) {
    const s = this.idle?.state; this.idleGarden.clear(); if (!s) return;
    const scale = 2 * Math.max(1, Math.min(2.5, HEIGHT / WIDTH)), x = WIDTH * .46, y = HEIGHT - 92;
    const color = ['#8fc690', '#ddabc2', '#d1dba0'][s.garden];
    const height = (12 + 35 * s.growth / 1200) * scale;
    for (let i = -1; i <= 1 && s.world.room === 0; i++) {
      const px = x + i * 13 * scale;
      this.idleGarden.rect(px, y - height, 2 * scale, height).fill('#78aa83');
      this.idleGarden.rect(px - 5 * scale, y - height * .55, 6 * scale, 3 * scale).rect(px, y - height * .75, 7 * scale, 3 * scale).fill(color);
      if (s.growth >= 1200) this.idleGarden.rect(px - 4 * scale, y - height - 5 * scale, 10 * scale, 7 * scale).fill(s.garden === 2 ? '#f4dfa2' : '#eab6bf').rect(px, y - height - 3 * scale, 3 * scale, 3 * scale).fill('#fff2bb');
    }
    for (let i = 0; i < s.eggs.length && s.world.room === 0; i++) {
      const ex = WIDTH * .58 + i * 16 * scale;
      this.idleGarden.rect(ex, y - 12 * scale, 7 * scale, 10 * scale).fill('#fff1d5').rect(ex + 2 * scale, y - 10 * scale, 3 * scale, 3 * scale).fill('#ead4b5');
    }
    const ids = new Set(s.young.map(f => f.id));
    for (const [id, sprite] of this.youngSprites) if (!ids.has(id)) { sprite.destroy(); this.youngSprites.delete(id); this.youngDarts.delete(id); }
    for (let i = 0; i < s.young.length; i++) {
      const f = s.young[i]; let sprite = this.youngSprites.get(f.id);
      const c = s.world.children[f.id];
      if (!sprite) { sprite = new Sprite(); sprite.anchor.set(.5); sprite.position.set(WIDTH * .5 + Math.sin(i * .8) * WIDTH * .19, HEIGHT * .58 + Math.cos(i * .56) * Math.min(65, HEIGHT * .1) + i % 3 * 15); this.creatures.addChild(sprite); this.youngSprites.set(f.id, sprite); }
      sprite.visible = !!c && c.room === s.world.room; if (!sprite.visible) { this.youngDarts.delete(f.id); continue; }
      sprite.texture = this.youngTextures.get(f.species)![c.shade][Math.floor(time * 4 + i) % 2];
      const age = stage(s.total - f.born), phase = time * .35 + i * .8, size = FISH_PROFILES[f.species].scale * [.52, .75, 1][age];
      sprite.scale.set(Math.cos(phase) < 0 ? -size : size, size);
      const p = this.game?.state.props[c.favorite as 'shell' | 'arch' | 'star'];
      const rest = age > 0 && (time + i * 3) % 40 > 25;
      let target = { x: (rest ? p?.on ? WIDTH * [.18, .5, .82][p.position] : WIDTH * .46 : WIDTH * .5) + Math.sin(phase) * WIDTH * (rest ? .025 : .19), y: (rest ? HEIGHT - 160 : HEIGHT * .58) + Math.cos(phase * .7) * Math.min(65, HEIGHT * .1) + i % 3 * 15 };
      const meal = food.find(p => Math.hypot(p.x - sprite.x, p.y - sprite.y) < 200);
      if (meal) target = meal;
      else if (this.game?.state.followPointer && this.game.pointer && !this.game.phrase) target = { x: this.game.pointer.x + Math.sin(phase) * 25, y: this.game.pointer.y + Math.cos(phase) * 20 };
      const dart = this.youngDarts.get(f.id);
      if (dart) {
        const delta = Math.max(0, Math.min(.04, dt)), steps = Math.max(1, Math.ceil(Math.hypot(dart.x, dart.y) * delta / 8));
        for (let step = 0; step < steps; step++) {
          const pos = safePosition({ x: sprite.x + dart.x * delta / steps, y: sprite.y + dart.y * delta / steps }, rocks, 24);
          sprite.position.set(pos.x, pos.y); if (pos.touched) { dart.left = 0; break; }
        }
        sprite.scale.x = (dart.x < 0 ? -1 : 1) * size;
        sprite.texture = this.youngTextures.get(f.species)![c.shade][Math.floor(time * 22 + i) % 2];
        dart.left -= delta; dart.x *= Math.exp(-delta * 2); dart.y *= Math.exp(-delta * 2);
        if (dart.left <= 0) this.youngDarts.delete(f.id);
      } else {
        const blend = Math.min(1, dt * 2.5); sprite.position.set(sprite.x + (target.x - sprite.x) * blend, sprite.y + (target.y - sprite.y) * blend);
      }
      const pos = safePosition({ x: Math.max(24, Math.min(WIDTH - 24, sprite.x)), y: Math.max(100, Math.min(HEIGHT - 110, sprite.y)) }, rocks, 24);
      sprite.position.set(pos.x, pos.y);
    }
    if (s.world.room === 0) {
      const cx = WIDTH * .78, cy = HEIGHT - 100, unit = Math.min(4, scale);
      this.idleGarden.rect(cx - 12 * unit, cy + 3 * unit, 24 * unit, 3 * unit).fill('#c39564').rect(cx - 8 * unit, cy - 5 * unit, 16 * unit, 8 * unit).fill('#eaa59b');
      this.idleGarden.rect(cx - 12 * unit, cy - 10 * unit, 5 * unit, 7 * unit).rect(cx + 8 * unit, cy - 10 * unit, 5 * unit, 7 * unit).fill('#eaa59b');
      this.idleGarden.rect(cx - 4 * unit, cy - 6 * unit, 2 * unit, 2 * unit).rect(cx + 3 * unit, cy - 6 * unit, 2 * unit, 2 * unit).fill('#284948');
      if (s.world.crab.pending) this.idleGarden.rect(cx - 2 * unit, cy - 19 * unit, 5 * unit, 5 * unit).fill('#fce2a1');
    }
  }
  effect(point: Point, kind: string, midi?: number) { this.ripple.push({ ...point, age: 0, kind, midi }); if (this.ripple.length > 40) this.ripple.shift(); }
  render(sim: Aquarium, dt: number, effectDt = dt) {
    this.visualTime += effectDt;
    if (this.game && this.game.danceSerial !== this.lastDance) { this.lastDance = this.game.danceSerial; this.danceEnd = this.visualTime + 3; }
    const theme = this.game?.state.theme ?? 'sea';
    if (theme !== this.themeKey) { this.themeKey = theme; this.background.removeChildren().forEach(child => child.destroy()); this.drawBackground(); }
    const key = `${sim.settings.rocks}/${sim.settings.stations}/${this.game?.state.rock}`;
    if (key !== this.settingsKey) { this.drawScenery(sim); this.settingsKey = key; }
    this.plants.visible = sim.settings.seaweed;
    const plant = this.game?.state.plant ?? 'green';
    if (plant !== this.plantKey) { this.plantKey = plant; this.plants.removeChildren().forEach(child => child.destroy()); this.plantSprites = []; this.drawPlants(); }
    const propKey = `${WIDTH}/${HEIGHT}/${JSON.stringify(this.game?.state.props)}`;
    if (propKey !== this.propKey) { this.propKey = propKey; this.drawProps(); }
    const visitorPoint = this.game?.visitorPoint(WIDTH, HEIGHT, sim.settings.rocks);
    this.visitorSprite.visible = !!visitorPoint;
    if (visitorPoint && this.game?.visitor) {
      const kind = this.game.visitor.kind;
      this.visitorSprite.texture = this.visitorTextures.get(kind)!; this.visitorSprite.position.set(Math.round(visitorPoint.x), Math.round(visitorPoint.y));
      this.visitorSprite.scale.set(kind === 'chest' ? 4 : 3.5); this.visitorSprite.alpha = kind === 'glow' ? .75 + Math.sin(this.game.time * 4) * .2 : 1;
    }
    for (const p of this.plantSprites) p.graphics.rotation = Math.sin(sim.time * .7 + p.phase) * .025;
    const live = new Set(sim.fish.map(f => f.id));
    for (const [id, sprite] of this.fishSprites) if (!live.has(id)) { sprite.destroy(); this.fishSprites.delete(id); }
    for (const fish of sim.fish) {
      if (sim.isAway(fish)) { const sprite = this.fishSprites.get(fish.id); if (sprite) sprite.visible = false; continue; }
      this.drawFish(fish, sim.time); this.fishSprites.get(fish.id)!.visible = true;
    }
    this.drawIdle(sim.time, dt, sim.food, sim.activeRocks());
    const predatorIds = new Set(sim.predators.map(p => p.id));
    for (const [id, sprite] of this.predatorSprites) if (!predatorIds.has(id)) { sprite.destroy(); this.predatorSprites.delete(id); }
    for (const p of sim.predators) {
      let sprite = this.predatorSprites.get(p.id);
      if (!sprite) { sprite = new Sprite(); sprite.anchor.set(.5); this.creatures.addChild(sprite); this.predatorSprites.set(p.id, sprite); }
      sprite.texture = this.predatorTextures.get(p.kind)!;
      const scale = PREDATOR_PROFILES[p.kind].scale, pulse = 1 + Math.sin(sim.time * 3 + p.id) * .07;
      sprite.position.set(Math.round(p.x), Math.round(p.y));
      if (p.kind === 'jellyfish') { sprite.scale.set(scale * pulse, scale / pulse); sprite.rotation = Math.sin(sim.time + p.id) * .08; }
      else if (p.kind === 'squid') { sprite.scale.set(scale * pulse, scale / pulse); sprite.rotation = p.angle + Math.PI / 2; }
      else { sprite.scale.set(Math.cos(p.angle) < 0 ? -scale : scale, scale); sprite.rotation = Math.sin(p.angle) * .12; }
      sprite.alpha = p.state === 'COOLDOWN' ? .76 : p.kind === 'jellyfish' ? .88 : 1;
    }
    this.food.clear();
    for (const f of sim.food) { this.food.rect(Math.round(f.x), Math.round(f.y), 4, 4).fill('#dfb876'); this.food.rect(Math.round(f.x), Math.round(f.y), 2, 2).fill('#ffe1a0'); }
    this.bubbles.clear();
    if (sim.settings.bubbles) for (const b of this.bubblePoints) {
      b.y -= b.speed * dt; if (b.y < 26) b.y = HEIGHT - 68;
      const x = Math.round(b.x + Math.sin(sim.time + b.phase) * 8), y = Math.round(b.y);
      this.bubbles.rect(x, y, b.r * 2, b.r * 2).stroke({ color: '#a3d1bd', alpha: .32, width: 1 });
      this.bubbles.rect(x + 1, y + 1, 2, 2).fill({ color: '#d5edcb', alpha: .5 });
    }
    this.selection.clear();
    if (visitorPoint && this.game?.visitor?.kind === 'crab' && !sim.settings.rocks) this.selection.circle(visitorPoint.x, visitorPoint.y, 25).stroke({ color: '#bce4ce', width: 2, alpha: .6 });
    const selected = sim.fish.find(f => f.id === sim.selected && !sim.isAway(f));
    if (selected) {
      this.selection.circle(selected.x, selected.y, 34).stroke({ color: '#d9ebaa', alpha: .8, width: 1.5 });
      this.selection.rect(selected.x - 3, selected.y - 44, 6, 6).fill('#d9ebaa');
    }
    const phrase = this.game?.phrase;
    if (phrase) {
      const degree = PHRASES[phrase.index].notes[phrase.step];
      for (const f of sim.fish) if (!sim.isAway(f) && degreeOf(f.id) === degree) {
        this.selection.circle(f.x, f.y, 28 + Math.sin(sim.time * 5) * 2).stroke({ color: '#ffe5a0', alpha: .85, width: 2 });
        this.selection.rect(f.x - 3, f.y - 39, 6, 6).fill('#ffe5a0');
      }
    }
    if (this.game?.call) this.selection.circle(this.game.call.x, this.game.call.y, 20).stroke({ color: '#f1c1bc', width: 2, alpha: .55 });
    if (this.game?.state.followPointer && this.game.pointer && !phrase) {
      const p = this.game.pointer;
      this.selection.circle(p.x, p.y, 12).stroke({ color: '#d5e9b7', width: 1.5, alpha: .65 });
      this.selection.circle(p.x, p.y, 3).fill({ color: '#d5e9b7', alpha: .8 });
    }
    this.ripples.clear();
    for (const ripple of this.ripple) {
      ripple.age += ripple.kind === 'note' || ripple.kind === 'heart' ? effectDt : dt;
      if (ripple.kind === 'heart') {
        const x = ripple.x - 8, y = ripple.y - 35 - ripple.age * 35, alpha = Math.max(0, 1 - ripple.age);
        this.ripples.rect(x, y, 6, 6).rect(x + 8, y, 6, 6).rect(x - 2, y + 4, 18, 6).rect(x + 2, y + 10, 10, 4).rect(x + 5, y + 14, 4, 3).fill({ color: '#ffc5c6', alpha }); continue;
      }
      if (ripple.kind === 'note') {
        const x = ripple.x, y = ripple.y - 24 - ripple.age * 55, alpha = Math.max(0, .9 - ripple.age);
        const color = ['#ffd78d', '#b2ead0', '#ded0f2', '#ffc5ac', '#fff4ce'][(ripple.midi ?? 0) % 5];
        this.ripples.rect(x - 5, y, 9, 6).fill({ color, alpha });
        this.ripples.rect(x + 1, y - 17, 3, 21).fill({ color, alpha });
        this.ripples.rect(x + 4, y - 17, 9, 4).fill({ color, alpha });
        continue;
      }
      this.ripples.circle(ripple.x, ripple.kind === 'feed' ? 40 : ripple.y, 12 + ripple.age * 65).stroke({ color: ripple.kind === 'scare' ? '#f5c88d' : '#d2e5ae', alpha: Math.max(0, .6 - ripple.age * .6), width: 2 });
    }
    this.ripple = this.ripple.filter(r => r.age < 1);
    this.app.render();
  }
  private drawFish(fish: Fish, time: number) {
    let sprite = this.fishSprites.get(fish.id);
    if (!sprite) { sprite = new Sprite(); sprite.anchor.set(.5); this.creatures.addChild(sprite); this.fishSprites.set(fish.id, sprite); }
    const scared = fish.fear > .38;
    const frame = fish.eating > 0 ? 2 : Math.floor(time * (fish.burstLeft > 0 ? 22 : scared ? 14 : fish.speed > 105 ? 10 : 5) + fish.phase) % 2;
    sprite.texture = this.textures.get(fish.species)![fish.color][frame];
    const scale = FISH_PROFILES[fish.species].scale + (fish.id % 3) * .08;
    sprite.position.set(Math.round(fish.x), Math.round(fish.y + Math.sin(time * 2 + fish.phase) * 1.5));
    sprite.scale.set((Math.cos(fish.angle) < 0 ? -1 : 1) * scale * (scared ? fish.species === 'puffer' ? 1.2 : 1.12 : 1), scale * (scared ? fish.species === 'puffer' ? 1.15 : .87 : 1));
    sprite.rotation = this.danceEnd > this.visualTime ? Math.sin((this.danceEnd - this.visualTime) * Math.PI * 2) * .75 : Math.sin(fish.angle) * (Math.cos(fish.angle) < 0 ? -1 : 1) * .18;
    sprite.tint = scared ? '#ffe7c5' : '#ffffff';
  }
  private drawProps() {
    const g = this.props; g.clear();
    for (const [id, p] of Object.entries(this.game?.state.props ?? {})) {
      if (!p?.on) continue;
      // Keep ground decorations recognizable above the toolbar in tall tanks.
      const scale = 1.6 * Math.max(1, Math.min(2.25, HEIGHT / WIDTH));
      const halfWidth = (id === 'arch' ? 37 : id === 'shell' ? 22 : 17) * scale;
      const preferredX = WIDTH * [.18, .5, .82][p.position] + (id === 'star' ? 25 : id === 'arch' ? -20 : 0);
      const x = Math.max(halfWidth + 8, Math.min(WIDTH - halfWidth - 8, preferredX)), y = HEIGHT - 75;
      const rect = (dx: number, dy: number, w: number, h: number, color: string) => g.rect(x + dx * scale, y + dy * scale, w * scale, h * scale).fill(color);
      if (id === 'shell') {
        rect(-22, -8, 44, 9, '#b58f8c'); rect(-18, -19, 36, 13, '#f0bdb0'); rect(-12, -26, 24, 10, '#f9d6bc');
        rect(-7, -20, 14, 13, '#fff2cf'); rect(-4, -22, 8, 4, '#ffffff');
      } else if (id === 'arch') {
        rect(-37, -48, 16, 48, '#79a294'); rect(21, -48, 16, 48, '#79a294'); rect(-28, -58, 56, 16, '#79a294');
        rect(-21, -62, 42, 8, '#b4ccb0'); rect(-37, -48, 7, 35, '#b4ccb0');
      } else {
        rect(-4, -30, 8, 30, '#e3c585'); rect(-17, -21, 34, 8, '#e3c585'); rect(-11, -13, 22, 10, '#e3c585');
        rect(-2, -24, 4, 18, '#fff0b0'); rect(-11, -17, 22, 4, '#fff0b0');
      }
    }
  }
}
