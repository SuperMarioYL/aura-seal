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

export type ElementKind = 'qi' | 'fire' | 'lightning' | 'ice' | 'gold' | 'wood' | 'blade';

/**
 * Per-effect color language (v0.3). Replaces the old single color+accent that made
 * all 12 effects read as "cyan + red". Layers map to render roles:
 * - core: bright near-white center (color-temperature tinted, drives bloom over-exposure)
 * - mid:  main energy body color
 * - rim:  darker outline / edge for contrast against the white core
 * - spark: particle / accent flecks
 * - glow: soft outer halo color
 */
export interface EffectPalette {
  core: string;
  mid: string;
  rim: string;
  spark: string;
  glow: string;
}

export interface EffectPreset {
  id: EffectKind;
  gesture: GestureKind;
  name: string;
  description: string;
  /** Primary body color — kept for back-compat; mirrors palette.mid. */
  color: string;
  /** Accent color — kept for back-compat; mirrors palette.spark. */
  accent: string;
  element: ElementKind;
  palette: EffectPalette;
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
