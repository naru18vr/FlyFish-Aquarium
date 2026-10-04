import { clamp, random } from '../math';
import { QUALITY, type Connectome, type Motor, type Quality, type Sensory } from '../types';

interface State { voltage: Float32Array; refractory: Uint8Array; previous: Uint8Array; current: Uint8Array; rates: Float32Array; rng: () => number }
export class BrainModel {
  private states = new Map<number, State>();
  private outgoing: { post: number; weight: number }[][] = [];
  neurons = 0; edges = 0;
  constructor(private data: Connectome, private quality: Quality) { this.configure(quality); }
  configure(quality: Quality) {
    this.quality = quality;
    this.neurons = Math.min(QUALITY[quality].neurons, this.data.neurons.length);
    const sums = new Float32Array(this.neurons);
    this.outgoing = Array.from({ length: this.neurons }, () => []);
    this.edges = 0;
    for (const [a, b, count] of this.data.edges) if (a < this.neurons && b < this.neurons) sums[b] += count;
    for (const [a, b, count] of this.data.edges) if (a < this.neurons && b < this.neurons) {
      const sign = ['GABA', 'GLUT'].includes(this.data.neurons[a].nt) ? -1 : 1;
      this.outgoing[a].push({ post: b, weight: sign * 2.2 * count / Math.max(1, sums[b]) });
      this.edges++;
    }
    this.states.clear();
  }
  reset() { this.states.clear(); }
  retain(ids: number[]) { const live = new Set(ids); for (const id of this.states.keys()) if (!live.has(id)) this.states.delete(id); }
  private state(id: number) {
    let state = this.states.get(id);
    if (!state) {
      const rng = random(id * 9173 + 123);
      state = { voltage: Float32Array.from({ length: this.neurons }, rng), refractory: new Uint8Array(this.neurons), previous: new Uint8Array(this.neurons), current: new Uint8Array(this.neurons), rates: new Float32Array(this.neurons), rng };
      this.states.set(id, state);
    }
    return state;
  }
  step(id: number, s: Sensory, noise = .1): { motor: Motor; activity: number[]; spikes: number } {
    const state = this.state(id), syn = new Float32Array(this.neurons), counts = new Float32Array(8), totals = new Float32Array(8);
    const threat = Math.max(s.enemyLeft, s.enemyRight, s.enemyFront), startle = Math.max(s.startleLeft, s.startleRight);
    // These eight projections are the artificial aquarium adapter. Anatomical
    // connections (not these projections) come from the measured connectome.
    const drive = [
      1.0 + s.foodLeft * 1.1 + s.enemyRight * 2.7 + s.wallRight * 2.1 + s.startleRight * 3.5 + s.touchRight * 2,
      1.0 + s.foodRight * 1.1 + s.enemyLeft * 2.7 + s.wallLeft * 2.1 + s.startleLeft * 3.5 + s.touchLeft * 2,
      1.6 + s.foodFront * .8 + threat * 2.1 + startle * 3,
      .5 + s.wallFront * 2.7 + (s.fishFront * .4),
      .6 + s.foodLeft + s.foodRight + s.foodFront,
      .7 + threat * 2 + startle * 2,
      .5 + s.wallLeft + s.wallRight + s.wallFront,
      .5 + (s.fishLeft + s.fishRight + s.fishFront) * .6,
    ];
    const substeps = Math.round(200 / QUALITY[this.quality].hz); // 5 ms LIF steps, equal simulated time at every quality.
    let spikes = 0;
    for (let tick = 0; tick < substeps; tick++) {
      syn.fill(0);
      for (let i = 0; i < this.neurons; i++) if (state.previous[i]) for (const edge of this.outgoing[i]) syn[edge.post] += edge.weight;
      for (let i = 0; i < this.neurons; i++) {
        state.current[i] = 0;
        const group = this.data.neurons[i].adapterGroup;
        if (state.refractory[i]) { state.refractory[i]--; state.rates[i] *= .94; continue; }
        const current = clamp(drive[group] + syn[i] + (state.rng() - .5) * noise, 0, 8);
        state.voltage[i] += .22 * (-state.voltage[i] + current);
        if (state.voltage[i] >= 1) {
          state.voltage[i] = 0; state.refractory[i] = 2; state.current[i] = 1;
          counts[group]++; spikes++;
        }
        state.rates[i] = state.rates[i] * .94 + state.current[i] * .06;
      }
      [state.previous, state.current] = [state.current, state.previous];
    }
    for (let i = 0; i < this.neurons; i++) totals[this.data.neurons[i].adapterGroup]++;
    const rate = (group: number) => clamp(counts[group] / Math.max(1, totals[group] * substeps) * 3.7);
    const activity = Array.from({ length: 32 }, (_, bin) => {
      let total = 0, n = 0;
      for (let i = bin; i < this.neurons; i += 32) { total += state.rates[i]; n++; }
      return clamp(total / Math.max(1, n) * 4);
    });
    return { motor: { turnLeft: rate(0), turnRight: rate(1), accelerate: rate(2), brake: rate(3) }, activity, spikes };
  }
}
