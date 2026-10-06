import type { FishSelection, FishSpecies, PredatorKind, PredatorSelection } from './species';
export type Quality = 'low' | 'medium' | 'high';
export interface Settings {
  fishCount: number; flyWeight: number; predators: number; stations: number;
  seaweed: boolean; rocks: boolean; bubbles: boolean; scare: boolean;
  startle: number; nearby: number; variation: number; quality: Quality;
  fishSpecies: FishSelection; predatorKind: PredatorSelection;
}
export const DEFAULTS: Settings = {
  fishCount: 24, flyWeight: .7, predators: 1, stations: 2,
  seaweed: true, rocks: true, bubbles: true, scare: true,
  startle: .8, nearby: .6, variation: .4, quality: 'medium',
  fishSpecies: 'mixed', predatorKind: 'mixed',
};
export const QUALITY = { low: { hz: 5, neurons: 256 }, medium: { hz: 10, neurons: 512 }, high: { hz: 15, neurons: 768 } };
export interface Motor { turnLeft: number; turnRight: number; accelerate: number; brake: number }
export const idleMotor = (): Motor => ({ turnLeft: 0, turnRight: 0, accelerate: .35, brake: 0 });
export interface Sensory {
  foodLeft: number; foodRight: number; foodFront: number; foodDistance: number;
  enemyLeft: number; enemyRight: number; enemyFront: number; enemyDistance: number;
  fishLeft: number; fishRight: number; fishFront: number; fishDistance: number;
  wallLeft: number; wallRight: number; wallFront: number;
  touchLeft: number; touchRight: number; startleLeft: number; startleRight: number;
}
export const emptySense = (): Sensory => ({
  foodLeft: 0, foodRight: 0, foodFront: 0, foodDistance: 1,
  enemyLeft: 0, enemyRight: 0, enemyFront: 0, enemyDistance: 1,
  fishLeft: 0, fishRight: 0, fishFront: 0, fishDistance: 1,
  wallLeft: 0, wallRight: 0, wallFront: 0, touchLeft: 0, touchRight: 0,
  startleLeft: 0, startleRight: 0,
});
export interface Point { x: number; y: number }
export interface Fish extends Point {
  species: FishSpecies;
  id: number; angle: number; speed: number; vx: number; vy: number;
  energy: number; hunger: number; fear: number; color: number; phase: number;
  traits: { maxSpeed: number; turnSpeed: number; curiosity: number; fearSensitivity: number; foodSensitivity: number; brainNoise: number };
  startleLeft: number; startleRight: number; eating: number;
  fly: Motor; program: Motor; action: Motor; sensory: Sensory;
  activity: number[]; spikes: number; target: Point | null; flyWeight: number; programWeight: number;
}
export interface Predator extends Point { id: number; kind: PredatorKind; angle: number; state: 'PATROL' | 'CHASE' | 'COOLDOWN'; timer: number; target: Fish | null }
export interface Food extends Point { id: number; age: number; vx: number; manual?: boolean }
export interface Rock extends Point { r: number }
export interface Station extends Point { timer: number }
export interface Connectome {
  version: string; license: string; source: string; sourceCommit: string;
  neurons: { id: string; type: string; side: string; nt: string; adapterGroup: number }[];
  edges: [number, number, number][];
}
export type BrainRequest =
  | { type: 'init'; revision: number; data: Connectome; quality: Quality }
  | { type: 'quality'; revision: number; quality: Quality }
  | { type: 'reset'; revision: number }
  | { type: 'tick'; revision: number; fish: { id: number; sensory: Sensory; noise: number }[] };
export type BrainResponse =
  | { type: 'ready'; revision: number; neurons: number; edges: number }
  | { type: 'result'; revision: number; elapsed: number; fish: { id: number; motor: Motor; activity: number[]; spikes: number }[] };
