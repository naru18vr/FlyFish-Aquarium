import type { Connectome } from '../types';

export function isConnectome(value: unknown): value is Connectome {
  if (!value || typeof value !== 'object') return false;
  const data = value as Connectome;
  if (!Array.isArray(data.neurons) || data.neurons.length === 0 || data.neurons.length > 768 || !Array.isArray(data.edges) || data.edges.length === 0) return false;
  if (!data.neurons.every(n => n && typeof n.id === 'string' && /^\d+$/.test(n.id) && typeof n.nt === 'string' && Number.isInteger(n.adapterGroup) && n.adapterGroup >= 0 && n.adapterGroup < 8)) return false;
  return data.edges.every(edge => Array.isArray(edge) && edge.length === 3 && edge.every(Number.isSafeInteger) && edge[0] >= 0 && edge[0] < data.neurons.length && edge[1] >= 0 && edge[1] < data.neurons.length && edge[2] > 0);
}
