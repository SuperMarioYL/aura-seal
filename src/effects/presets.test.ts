import { describe, expect, it } from 'vitest';
import { EFFECT_PRESETS, JUMP_PRESET, presetForGesture, presetById } from './presets';

const HEX = /^#[0-9a-fA-F]{6}$/;
const ALL = [...EFFECT_PRESETS, JUMP_PRESET];

describe('effect presets palette', () => {
  it('every preset has a full 5-layer palette of valid hex colors', () => {
    for (const preset of ALL) {
      for (const key of ['core', 'mid', 'rim', 'spark', 'glow'] as const) {
        expect(HEX.test(preset.palette[key]), `${preset.id}.${key}=${preset.palette[key]}`).toBe(
          true,
        );
      }
    }
  });

  it('keeps legacy color/accent in sync with palette (back-compat invariant)', () => {
    for (const preset of ALL) {
      expect(preset.color).toBe(preset.palette.mid);
      expect(preset.accent).toBe(preset.palette.spark);
    }
  });

  it('uses a varied set of body colors (not the old cyan+red monotony)', () => {
    const mids = new Set(EFFECT_PRESETS.map((p) => p.palette.mid));
    expect(mids.size).toBeGreaterThanOrEqual(9);
  });

  it('maps every gesture-bound preset to its gesture and jump to the jump preset', () => {
    expect(presetForGesture('jump')).toBe(JUMP_PRESET);
    for (const preset of EFFECT_PRESETS) {
      expect(presetForGesture(preset.gesture).id).toBe(preset.id);
    }
  });

  it('resolves presets by id', () => {
    expect(presetById('beam').id).toBe('beam');
  });
});
