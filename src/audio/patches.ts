import type { EffectKind } from '../effects/types';

// Procedural sfx — each effect gets a synth patch (no audio files, no licensing,
// nothing to lazy-load over the network). Patches are data so they're easy to tune
// and unit-test for coverage.
export interface SfxPatch {
  /** Tonal oscillator layer. */
  tone?: {
    type: OscillatorType;
    freq: number;
    freqEnd?: number;
    gain: number;
  };
  /** Filtered white-noise layer (impact / air / blade). */
  noise?: {
    gain: number;
    filter: BiquadFilterType;
    cutoff: number;
    cutoffEnd?: number;
    q?: number;
  };
  /** Sub thump for weighty hits. */
  sub?: {
    freq: number;
    gain: number;
  };
  attack: number;
  duration: number;
}

export const SFX_PATCHES: Record<EffectKind, SfxPatch> = {
  // 灵印阵 — bright chime shimmer
  seal: {
    tone: { type: 'triangle', freq: 660, freqEnd: 990, gain: 0.5 },
    noise: { gain: 0.12, filter: 'highpass', cutoff: 4000 },
    attack: 0.01,
    duration: 0.9,
  },
  // 冲击波 — low boom + noise blast
  shockwave: {
    tone: { type: 'sawtooth', freq: 180, freqEnd: 70, gain: 0.5 },
    noise: { gain: 0.5, filter: 'lowpass', cutoff: 2200, cutoffEnd: 300 },
    sub: { freq: 60, gain: 0.6 },
    attack: 0.005,
    duration: 0.7,
  },
  // 能量球 — rising charge hum
  energy_orb: {
    tone: { type: 'sawtooth', freq: 90, freqEnd: 320, gain: 0.42 },
    noise: { gain: 0.1, filter: 'bandpass', cutoff: 600, cutoffEnd: 1600, q: 6 },
    attack: 0.2,
    duration: 1.1,
  },
  // 拳风 — quick swoosh snap
  speed_lines: {
    noise: { gain: 0.55, filter: 'bandpass', cutoff: 900, cutoffEnd: 2600, q: 1.2 },
    attack: 0.005,
    duration: 0.32,
  },
  // 光柱 — bright descending beam
  light_column: {
    tone: { type: 'sine', freq: 1200, freqEnd: 500, gain: 0.45 },
    noise: { gain: 0.16, filter: 'highpass', cutoff: 3000 },
    attack: 0.02,
    duration: 0.85,
  },
  // 爆气 — explosive burst + sub
  aura_burst: {
    tone: { type: 'sawtooth', freq: 140, freqEnd: 60, gain: 0.4 },
    noise: { gain: 0.6, filter: 'lowpass', cutoff: 3000, cutoffEnd: 400 },
    sub: { freq: 48, gain: 0.7 },
    attack: 0.004,
    duration: 0.6,
  },
  // 护盾 — low resonant hum
  barrier: {
    tone: { type: 'square', freq: 120, freqEnd: 150, gain: 0.38 },
    noise: { gain: 0.1, filter: 'bandpass', cutoff: 300, q: 8 },
    attack: 0.05,
    duration: 1.0,
  },
  // 天幕落光 — airy descending shimmer
  skyfall: {
    tone: { type: 'sine', freq: 1500, freqEnd: 600, gain: 0.4 },
    noise: { gain: 0.2, filter: 'highpass', cutoff: 2500 },
    attack: 0.04,
    duration: 1.0,
  },
  // 斗气护身 — short fiery whoosh
  guard_flare: {
    tone: { type: 'sawtooth', freq: 220, freqEnd: 130, gain: 0.34 },
    noise: { gain: 0.4, filter: 'lowpass', cutoff: 2000, cutoffEnd: 700 },
    attack: 0.01,
    duration: 0.5,
  },
  // 指令射线 — laser zap
  beam: {
    tone: { type: 'square', freq: 1800, freqEnd: 700, gain: 0.4 },
    noise: { gain: 0.18, filter: 'bandpass', cutoff: 3000, q: 3 },
    attack: 0.003,
    duration: 0.4,
  },
  // 横扫斩击 — blade air-cut sweep
  slash: {
    noise: { gain: 0.6, filter: 'bandpass', cutoff: 1400, cutoffEnd: 4200, q: 2 },
    tone: { type: 'sawtooth', freq: 300, freqEnd: 120, gain: 0.18 },
    attack: 0.004,
    duration: 0.34,
  },
};

export function patchFor(id: EffectKind): SfxPatch {
  return SFX_PATCHES[id] ?? SFX_PATCHES.seal;
}
