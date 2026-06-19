import { describe, expect, it } from 'vitest';
import { SFX_PATCHES, patchFor } from './patches';
import { EFFECT_PRESETS } from '../effects/presets';

describe('sfx patches', () => {
  it('defines a patch for every effect preset id', () => {
    for (const preset of EFFECT_PRESETS) {
      expect(SFX_PATCHES[preset.id], `missing sfx for ${preset.id}`).toBeDefined();
    }
  });

  it('every patch has sane envelope timing and at least one sound layer', () => {
    for (const [id, patch] of Object.entries(SFX_PATCHES)) {
      expect(patch.duration, `${id} duration`).toBeGreaterThan(0);
      expect(patch.attack, `${id} attack`).toBeGreaterThanOrEqual(0);
      expect(patch.attack, `${id} attack < duration`).toBeLessThan(patch.duration);
      expect(Boolean(patch.tone || patch.noise || patch.sub), `${id} has a layer`).toBe(true);
    }
  });

  it('falls back to a valid patch for an unknown id', () => {
    expect(patchFor('seal')).toBe(SFX_PATCHES.seal);
  });
});
