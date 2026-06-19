import type { GestureKind } from '../vision/types';

export type EffectKind =
  | 'seal'
  | 'shockwave'
  | 'energy_orb'
  | 'speed_lines'
  | 'light_column'
  | 'aura_burst'
  | 'barrier'
  | 'skyfall'
  | 'guard_flare'
  | 'beam'
  | 'slash';

export interface EffectPreset {
  id: EffectKind;
  gesture: GestureKind;
  name: string;
  description: string;
  color: string;
  accent: string;
  intensity: number;
  durationMs: number;
}

export interface EffectRuntime {
  id: string;
  preset: EffectPreset;
  anchor: { x: number; y: number };
  secondaryAnchor?: { x: number; y: number };
  direction: { x: number; y: number };
  startedAt: number;
  durationMs: number;
  seed: number;
}
