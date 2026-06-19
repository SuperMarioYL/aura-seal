import { describe, expect, it } from 'vitest';
import { ComboDetector } from './combos';
import { INITIAL_SCORE, ratingFor, registerHit } from './scoring';
import { applySkin, rotateHue, SKINS } from './skins';

describe('ComboDetector', () => {
  it('detects a combo when the sequence lands within the window', () => {
    const d = new ComboDetector();
    expect(d.push('charge_stance', 1000)).toBeNull();
    const hit = d.push('push_palm', 2000);
    expect(hit?.def.id).toBe('meteor');
  });

  it('does not fire when the window is exceeded', () => {
    const d = new ComboDetector();
    d.push('charge_stance', 1000);
    expect(d.push('push_palm', 1000 + 9999)).toBeNull();
  });

  it('consumes history so it cannot immediately re-fire', () => {
    const d = new ComboDetector();
    d.push('charge_stance', 1000);
    expect(d.push('push_palm', 1500)?.def.id).toBe('meteor');
    expect(d.push('push_palm', 1700)).toBeNull();
  });

  it('ignores unrelated gestures', () => {
    const d = new ComboDetector();
    expect(d.push('raised_hand', 1000)).toBeNull();
    expect(d.push('crouch', 1200)).toBeNull();
  });
});

describe('scoring', () => {
  it('grows the combo within the window and resets after a lull', () => {
    const a = registerHit(INITIAL_SCORE, 0.9, 1000);
    expect(a.state.combo).toBe(1);
    const b = registerHit(a.state, 0.9, 2000);
    expect(b.state.combo).toBe(2);
    const c = registerHit(b.state, 0.9, 2000 + 9000);
    expect(c.state.combo).toBe(1);
  });

  it('awards more for higher combo and rating', () => {
    const single = registerHit(INITIAL_SCORE, 0.5, 1000);
    expect(single.rating).toBe('GOOD');
    const first = registerHit(INITIAL_SCORE, 0.95, 1000);
    const second = registerHit(first.state, 0.95, 1500);
    expect(second.gained).toBeGreaterThan(first.gained);
    expect(first.rating).toBe('PERFECT');
  });

  it('tracks best score', () => {
    const a = registerHit(INITIAL_SCORE, 0.9, 1000);
    expect(a.state.best).toBe(a.state.score);
  });

  it('thresholds ratings', () => {
    expect(ratingFor(0.9)).toBe('PERFECT');
    expect(ratingFor(0.7)).toBe('GREAT');
    expect(ratingFor(0.3)).toBe('GOOD');
  });
});

describe('skins', () => {
  it('origin skin leaves the palette unchanged', () => {
    const pal = {
      core: '#ffffff',
      mid: '#45ddff',
      rim: '#166f9c',
      spark: '#ffd479',
      glow: '#34c8ff',
    };
    expect(applySkin(pal, SKINS[0])).toEqual(pal);
  });

  it('rotateHue(0) is identity and output is always valid hex', () => {
    expect(rotateHue('#45ddff', 0)).toBe('#45ddff');
    expect(rotateHue('#45ddff', 120)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a non-zero skin actually changes the colors', () => {
    const pal = {
      core: '#ffffff',
      mid: '#45ddff',
      rim: '#166f9c',
      spark: '#ffd479',
      glow: '#34c8ff',
    };
    const skinned = applySkin(pal, SKINS[1]);
    expect(skinned.mid).not.toBe(pal.mid);
  });
});
