// Original compositions and synthesized game sounds; no recordings or remote assets.
export const TRACKS = {
  sunshine: { name: 'ひだまりピコピコ', bpm: 108, root: 60, wave: 'square' as OscillatorType,
    melody: [0,-1,2,-1,4,2,1,-1,2,-1,1,-1,0,-1,-1,-1, 2,-1,4,-1,5,4,2,-1,1,-1,2,-1,4,-1,-1,-1,
      4,-1,5,-1,7,5,4,-1,2,-1,4,-1,1,-1,-1,-1, 2,-1,1,-1,0,1,2,-1,1,-1,0,-1,0,-1,-1,-1],
    bass: [0,9,5,7], chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]], drum: true },
  bubbles: { name: '泡のオルゴール', bpm: 78, root: 65, wave: 'sine' as OscillatorType,
    melody: [4,-1,-1,-1,2,-1,1,-1,0,-1,-1,-1,2,-1,-1,-1, 5,-1,-1,-1,4,-1,2,-1,1,-1,-1,-1,2,-1,-1,-1,
      7,-1,-1,-1,5,-1,4,-1,2,-1,-1,-1,4,-1,-1,-1, 2,-1,-1,-1,1,-1,0,-1,1,-1,-1,-1,0,-1,-1,-1],
    bass: [0,5,9,7], chords: [[0,4,7],[5,9,12],[9,12,16],[7,11,14]], drum: false },
  arcade: { name: 'おさんぽアーケード', bpm: 124, root: 62, wave: 'square' as OscillatorType,
    melody: [0,2,-1,4,2,-1,1,-1,0,1,2,-1,4,-1,2,-1, 4,5,-1,7,5,-1,4,-1,2,4,5,-1,4,-1,2,-1,
      5,7,-1,5,4,-1,2,-1,4,2,1,-1,2,-1,4,-1, 2,1,-1,0,1,-1,2,-1,1,2,1,-1,0,-1,-1,-1],
    bass: [0,7,9,5], chords: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]], drum: true },
  picnic: { name: 'おひるねピクニック', bpm: 94, root: 67, wave: 'triangle' as OscillatorType,
    melody: [0,-1,-1,-1,2,-1,-1,-1,4,-1,4,-1,2,-1,-1,-1,1,-1,-1,-1,0,-1,-1,-1,2,-1,2,-1,4,-1,-1,-1,5,-1,-1,-1,4,-1,-1,-1,2,-1,2,-1,1,-1,-1,-1,2,-1,-1,-1,1,-1,-1,-1,0,-1,0,-1,0,-1,-1,-1],
    bass: [0,9,5,7], chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]], drum: false },
  moonlight: { name: '月あかりの子守唄', bpm: 66, root: 57, wave: 'sine' as OscillatorType,
    melody: [4,-1,-1,-1,2,-1,-1,-1,0,-1,0,-1,1,-1,-1,-1,2,-1,-1,-1,4,-1,-1,-1,5,-1,5,-1,4,-1,-1,-1,7,-1,-1,-1,5,-1,-1,-1,4,-1,4,-1,2,-1,-1,-1,1,-1,-1,-1,2,-1,-1,-1,1,-1,1,-1,0,-1,-1,-1],
    bass: [0,5,9,7], chords: [[0,4,7],[5,9,12],[9,12,16],[7,11,14]], drum: false },
  coral: { name: 'サンゴのダンス', bpm: 116, root: 64, wave: 'square' as OscillatorType,
    melody: [0,2,-1,-1,1,-1,-1,2,2,-1,-1,-1,4,6,-1,-1,2,-1,-1,-1,5,-1,-1,6,4,6,-1,-1,2,-1,-1,-1,4,-1,-1,-1,7,9,-1,8,5,-1,-1,-1,4,-1,-1,-1,2,4,-1,-1,1,-1,-1,2,2,-1,-1,-1,0,2,-1,-1],
    bass: [0,9,5,7], chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]], drum: true },
  rain: { name: '雨つぶのメロディ', bpm: 84, root: 69, wave: 'triangle' as OscillatorType,
    melody: [2,-1,-1,-1,4,-1,-1,-1,5,-1,5,-1,4,-1,-1,-1,2,-1,-1,-1,1,-1,-1,-1,0,-1,0,-1,2,-1,-1,-1,4,-1,-1,-1,5,-1,-1,-1,7,-1,7,-1,5,-1,-1,-1,4,-1,-1,-1,2,-1,-1,-1,1,-1,1,-1,0,-1,-1,-1],
    bass: [0,5,9,7], chords: [[0,4,7],[5,9,12],[9,12,16],[7,11,14]], drum: false },
  stars: { name: '星くずパレード', bpm: 132, root: 60, wave: 'square' as OscillatorType,
    melody: [5,7,-1,-1,4,-1,-1,5,2,-1,-1,-1,4,6,-1,-1,7,-1,-1,-1,5,-1,-1,6,4,6,-1,-1,2,-1,-1,-1,5,-1,-1,-1,7,9,-1,8,9,-1,-1,-1,7,-1,-1,-1,5,7,-1,-1,4,-1,-1,5,2,-1,-1,-1,0,2,-1,-1],
    bass: [0,9,5,7], chords: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]], drum: true },
  harbor: { name: '夕暮れの港', bpm: 72, root: 62, wave: 'sine' as OscillatorType,
    melody: [0,-1,-1,-1,1,-1,-1,-1,4,-1,4,-1,2,-1,-1,-1,5,-1,-1,-1,4,-1,-1,-1,2,-1,2,-1,1,-1,-1,-1,4,-1,-1,-1,2,-1,-1,-1,1,-1,1,-1,0,-1,-1,-1,2,-1,-1,-1,4,-1,-1,-1,1,-1,1,-1,0,-1,-1,-1],
    bass: [0,5,9,7], chords: [[0,4,7],[5,9,12],[9,12,16],[7,11,14]], drum: false },
};
export const TIMBRES = { chip: 'ピコピコ', pluck: 'ぽろん', sparkle: 'きらきら', bubble: 'ぷくぷく', bell: 'ちりん', bounce: 'ぴょこん', marimba: 'ころころ', echo: 'こだま' };
export type TrackId = keyof typeof TRACKS;
export type Timbre = keyof typeof TIMBRES;
export interface AudioSettings { enabled: boolean; bgm: boolean; effects: boolean; sync: boolean; track: TrackId; timbre: Timbre; volume: number }
export const AUDIO_DEFAULTS: AudioSettings = { enabled: false, bgm: true, effects: true, sync: true, track: 'sunshine', timbre: 'chip', volume: .4 };
export function readAudioSettings(value: unknown): AudioSettings {
  const settings = { ...AUDIO_DEFAULTS };
  if (!value || typeof value !== 'object') return settings;
  const saved = value as Record<string, unknown>;
  for (const key of ['enabled', 'bgm', 'effects', 'sync'] as const) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
  if (typeof saved.track === 'string' && Object.hasOwn(TRACKS, saved.track)) settings.track = saved.track as TrackId;
  if (typeof saved.timbre === 'string' && Object.hasOwn(TIMBRES, saved.timbre)) settings.timbre = saved.timbre as Timbre;
  if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) settings.volume = Math.max(0, Math.min(1, saved.volume));
  return settings;
}
const PENTATONIC = [0,2,4,7,9];
export const scaleNote = (root: number, degree: number) => root + PENTATONIC[((degree % 5) + 5) % 5] + 12 * Math.floor(degree / 5);
export const fishNote = (track: TrackId, id: number) => scaleNote(TRACKS[track].root + 12, (Math.max(1, Math.floor(id)) - 1) % 10);
export function tapTime(now: number, origin: number, bpm: number, sync: boolean) {
  if (!sync) return now + .006;
  const step = 60 / bpm / 4;
  const next = origin + Math.ceil((now + .006 - origin) / step) * step;
  // Keep taps responsive; snap only when the next sixteenth is close.
  return next - now <= .075 ? next : now + .006;
}
export interface AudioSnapshot { enabled: boolean; unlocked: boolean; playing: boolean; unavailable: boolean; contextState: string; voices: number; musicNotes: number; effectsPlayed: number; lastMidi: number; lastDelay: number; level: number }
interface Voice { oscillator: OscillatorNode; gain: GainNode; bus: 'music' | 'effect'; ending: boolean }
export class AquariumAudio {
  onChange = () => {};
  private context: AudioContext | null = null;
  private master: GainNode | null = null; private music: GainNode | null = null; private effect: GainNode | null = null;
  private analyser: AnalyserNode | null = null; private samples = new Float32Array(1024);
  private voices = new Set<Voice>(); private timer = 0; private step = 0; private next = 0; private origin = 0;
  private paused = false; private hidden = false; private unlocked = false; private unavailable = false;
  private musicNotes = 0; private effectsPlayed = 0; private lastMidi = 0; private lastDelay = 0;
  constructor(public settings: AudioSettings) {}
  get snapshot(): AudioSnapshot {
    let level = 0;
    if (this.context?.state === 'running' && this.analyser) {
      this.analyser.getFloatTimeDomainData(this.samples);
      for (const x of this.samples) level += x * x;
      level = Math.sqrt(level / this.samples.length);
    }
    return { enabled: this.settings.enabled, unlocked: this.unlocked, playing: !!this.timer,
      unavailable: this.unavailable, contextState: this.context?.state ?? 'not-created', voices: this.voices.size,
      musicNotes: this.musicNotes, effectsPlayed: this.effectsPlayed, lastMidi: this.lastMidi, lastDelay: this.lastDelay, level };
  }
  async activate() {
    if (!this.settings.enabled || this.hidden) return false;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) throw new Error('Audio unavailable');
        const context = this.context = new Constructor({ latencyHint: 'interactive' });
        this.master = context.createGain(); this.master.gain.value = 0;
        this.music = context.createGain(); this.music.gain.value = .19;
        this.effect = context.createGain(); this.effect.gain.value = .29;
        this.music.connect(this.master); this.effect.connect(this.master);
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 5200;
        const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -15; compressor.knee.value = 12; compressor.ratio.value = 5;
        compressor.attack.value = .003; compressor.release.value = .12;
        this.analyser = context.createAnalyser(); this.analyser.fftSize = 1024;
        this.master.connect(filter); filter.connect(compressor); compressor.connect(this.analyser); this.analyser.connect(context.destination);
        context.onstatechange = () => this.onChange();
      }
      await this.context.resume();
      if (!this.settings.enabled || this.hidden) { this.refresh(); return false; }
      this.unlocked = this.context.state === 'running';
      this.unavailable = false;
      this.refresh(); this.onChange(); return this.unlocked;
    } catch { this.unavailable = true; this.stopMusic(); this.onChange(); return false; }
  }
  change<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) {
    const was = this.settings[key]; this.settings[key] = value;
    if (key === 'track' && was !== value) this.stopMusic();
    if (key === 'effects' && !value) this.stopVoices('effect');
    this.refresh(); this.onChange();
  }
  pause(paused: boolean) { this.paused = paused; this.refresh(); this.onChange(); }
  visibility(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) { this.refresh(); }
    else if (this.unlocked && this.settings.enabled) void this.activate();
    this.onChange();
  }
  private refresh() {
    if (!this.context || !this.master) return;
    const audible = this.settings.enabled && !this.hidden;
    this.master.gain.setTargetAtTime(audible ? this.settings.volume : 0, this.context.currentTime, .012);
    if (!audible) {
      this.stopMusic(); this.stopVoices('effect');
      if (this.context.state === 'running') void this.context.suspend().catch(() => {});
      return;
    }
    if (!this.settings.bgm || this.paused || !this.unlocked || this.context.state !== 'running') this.stopMusic();
    else if (!this.timer) {
      this.step = 0; this.next = this.origin = this.context.currentTime + .04;
      this.schedule(); this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }
  private stopMusic() { window.clearInterval(this.timer); this.timer = 0; this.stopVoices('music'); }
  private stopVoices(bus: Voice['bus']) {
    if (!this.context) return;
    for (const v of this.voices) if (v.bus === bus && !v.ending) this.endVoice(v);
  }
  private endVoice(v: Voice) {
    if (!this.context || v.ending) return;
    v.ending = true;
    const now = this.context.currentTime;
    v.gain.gain.cancelScheduledValues(now); v.gain.gain.setTargetAtTime(0, now, .004);
    try { v.oscillator.stop(now + .025); } catch { /* Already ended. */ }
  }
  private tone(midi: number, when: number, duration: number, wave: OscillatorType, volume: number, bus: Voice['bus'], pan = 0, slide = 0) {
    const c = this.context, output = bus === 'music' ? this.music : this.effect;
    if (!c || !output || this.voices.size >= 64) return;
    if (bus === 'effect') {
      const active = [...this.voices].filter(v => v.bus === 'effect' && !v.ending);
      if (active.length >= 12) this.endVoice(active[0]);
    }
    const oscillator = c.createOscillator(), gain = c.createGain(), panner = c.createStereoPanner();
    const start = Math.max(c.currentTime + .001, when), end = start + duration;
    oscillator.type = wave; oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(440 * 2 ** ((midi + slide - 69) / 12), end);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    panner.pan.value = Math.max(-.7, Math.min(.7, pan));
    oscillator.connect(gain); gain.connect(panner); panner.connect(output);
    const voice: Voice = { oscillator, gain, bus, ending: false }; this.voices.add(voice);
    oscillator.onended = () => { this.voices.delete(voice); oscillator.disconnect(); gain.disconnect(); panner.disconnect(); };
    oscillator.start(start); oscillator.stop(end + .015);
  }
  private schedule() {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.settings.enabled || !this.settings.bgm || this.paused || this.hidden) return;
    const song = TRACKS[this.settings.track], duration = 60 / song.bpm / 4;
    // Recover from a stalled foreground without playing a burst of missed notes.
    if (this.next < c.currentTime) {
      const missed = Math.ceil((c.currentTime + .006 - this.next) / duration);
      this.step += missed; this.next += missed * duration;
    }
    while (this.next < c.currentTime + .14) {
      const step = this.step % 64, bar = Math.floor(step / 16), beat = step % 16, t = this.next;
      const degree = song.melody[step];
      if (degree >= 0) {
        this.tone(scaleNote(song.root + 12, degree), t, duration * (song.drum ? 1.7 : 3.8), song.wave, song.drum ? .34 : .52, 'music', -.16);
        if (!song.drum) this.tone(scaleNote(song.root + 24, degree), t, duration * 2.8, 'sine', .1, 'music', .2);
        this.musicNotes++;
      }
      if (beat % 4 === 0) this.tone(song.root - 12 + song.bass[bar] + (beat === 8 ? 7 : 0), t, duration * 2.8, 'triangle', .8, 'music');
      if (beat % 2 === 0) {
        const chord = song.chords[bar];
        this.tone(song.root + chord[(beat / 2) % 3], t + duration * .08, duration * 1.6, 'triangle', .22, 'music', .24);
      }
      if (song.drum && beat % 4 === 0) this.tone(43, t, .065, 'sine', beat % 8 === 0 ? .48 : .2, 'music', 0, -18);
      if (song.drum && beat % 2 === 1) this.tone(96, t, .025, 'triangle', .09, 'music', -.25, -7);
      this.step++; this.next += duration;
    }
  }
  async fish(id: number, pan = 0) {
    if (!this.settings.enabled || !this.settings.effects || this.hidden) return null;
    if (!await this.activate() || !this.context || !this.settings.effects) return null;
    const now = this.context.currentTime;
    const midi = fishNote(this.settings.track, id), song = TRACKS[this.settings.track];
    const when = tapTime(now, this.origin, song.bpm, this.settings.sync && !!this.timer);
    const timbre = this.settings.timbre;
    const voices: Record<Timbre, [OscillatorType, number, number, number]> = {
      chip: ['square', .19, .4, 0], pluck: ['triangle', .42, .65, 0], sparkle: ['sine', .42, .65, 0],
      bubble: ['sine', .16, .7, 12], bell: ['sine', .65, .55, 0], bounce: ['square', .12, .32, -12],
      marimba: ['triangle', .22, .75, 0], echo: ['triangle', .28, .5, 0],
    };
    const [wave, length, volume, slide] = voices[timbre];
    this.tone(midi, when, length, wave, volume, 'effect', pan, slide);
    if (timbre === 'bell') this.tone(midi + 19, when, .34, 'sine', .13, 'effect', -pan);
    if (timbre === 'marimba') this.tone(midi + 12, when, .06, 'sine', .2, 'effect', pan);
    if (timbre === 'echo') for (let i = 1; i <= 2; i++) this.tone(midi, when + i * .11, .2, 'triangle', .23 / i, 'effect', i % 2 ? -pan : pan);
    if (timbre === 'sparkle') this.tone(midi + 12, when + .025, .3, 'sine', .22, 'effect', -pan);
    this.effectsPlayed++; this.lastMidi = midi; this.lastDelay = when - now;
    return { midi, delay: when - now };
  }
  async feed() {
    if (!this.settings.enabled || !this.settings.effects || this.hidden || !await this.activate() || !this.context || !this.settings.effects) return;
    const now = this.context.currentTime, root = TRACKS[this.settings.track].root;
    for (const [i, degree] of [2,4,5].entries()) this.tone(scaleNote(root + 12, degree), now + .006 + i * .055, .18, 'triangle', .38, 'effect', (i - 1) * .15);
    this.effectsPlayed++;
  }
  dispose() {
    this.stopMusic(); this.stopVoices('effect');
    if (this.context) void this.context.close().catch(() => {});
    this.unlocked = false;
  }
}
