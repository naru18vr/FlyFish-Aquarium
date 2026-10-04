/// <reference lib="webworker" />
import { BrainModel } from './model';
import type { BrainRequest, BrainResponse } from '../types';
const scope = self as unknown as DedicatedWorkerGlobalScope;
let model: BrainModel | null = null;
const reply = (message: BrainResponse) => scope.postMessage(message);
scope.onmessage = ({ data }: MessageEvent<BrainRequest>) => {
  if (data.type === 'init') model = new BrainModel(data.data, data.quality);
  else if (data.type === 'quality') model?.configure(data.quality);
  else if (data.type === 'reset') model?.reset();
  else if (data.type === 'tick' && model) {
    const start = performance.now();
    model.retain(data.fish.map(f => f.id));
    const fish = data.fish.map(f => ({ id: f.id, ...model!.step(f.id, f.sensory, f.noise) }));
    reply({ type: 'result', revision: data.revision, elapsed: performance.now() - start, fish });
    return;
  }
  if (model) reply({ type: 'ready', revision: data.revision, neurons: model.neurons, edges: model.edges });
};
