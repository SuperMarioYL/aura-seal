import { describe, expect, it } from 'vitest';
import type { Landmark } from '../types';
import { extractHandPose } from './handFeatures';
import { classifySeal } from './sealClassifier';
import { SealStabilizer } from './sealStabilizer';
import { SealSequencer } from '../../play/seals';

// Build a synthetic 21-point hand from a per-finger extended flag [thumb,i,m,r,p].
// Straight finger → mcp/pip/tip collinear (angle ≈ π); curled → tip near mcp (angle ≈ 0).
function makeHand(ext: boolean[]): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.9 }));
  pts[0] = { x: 0.5, y: 0.95 };
  pts[1] = { x: 0.45, y: 0.88 };
  pts[2] = { x: 0.42, y: 0.82 };
  if (ext[0]) {
    pts[3] = { x: 0.37, y: 0.76 };
    pts[4] = { x: 0.32, y: 0.7 };
  } else {
    pts[3] = { x: 0.44, y: 0.8 };
    pts[4] = { x: 0.47, y: 0.83 };
  }
  for (let f = 0; f < 4; f += 1) {
    const x = 0.4 + f * 0.045;
    const mcp = 5 + f * 4;
    const pip = 6 + f * 4;
    const dip = 7 + f * 4;
    const tip = 8 + f * 4;
    pts[mcp] = { x, y: 0.72 };
    pts[pip] = { x, y: 0.62 };
    if (ext[f + 1]) {
      pts[dip] = { x, y: 0.54 };
      pts[tip] = { x, y: 0.46 };
    } else {
      pts[dip] = { x, y: 0.66 };
      pts[tip] = { x, y: 0.7 };
    }
  }
  return pts;
}

describe('hand seal classification', () => {
  it('reads finger extension into a mask', () => {
    const pose = extractHandPose(makeHand([false, true, true, false, false]));
    expect(pose).not.toBeNull();
    // index + middle extended → bits 1,2 set (thumb bit0 clear, ring/pinky clear)
    expect((pose!.mask >> 1) & 0b1111).toBe(0b0011);
  });

  it('classifies fist / open / scissors / horns', () => {
    expect(classifySeal(makeHand([false, false, false, false, false]))?.seal).toBe('zi');
    expect(classifySeal(makeHand([true, true, true, true, true]))?.seal).toBe('wu');
    expect(classifySeal(makeHand([false, true, true, false, false]))?.seal).toBe('mao');
    expect(classifySeal(makeHand([false, true, false, false, true]))?.seal).toBe('yin');
  });

  it('exact masks are high confidence', () => {
    expect(classifySeal(makeHand([false, false, false, false, false]))!.confidence).toBeGreaterThan(
      0.8,
    );
  });
});

describe('SealStabilizer', () => {
  it('emits once after a few confirming frames, not every frame', () => {
    const s = new SealStabilizer();
    const fist = makeHand([false, false, false, false, false]);
    const emits = [0, 1, 2, 3, 4].map((i) => s.push(fist, 1000 + i * 30)).filter(Boolean);
    expect(emits).toHaveLength(1);
    expect(emits[0]!.seal).toBe('zi');
  });
});

describe('SealSequencer', () => {
  it('casts a spell when the seal sequence completes in time', () => {
    const seq = new SealSequencer();
    expect(seq.push('yin', 1000).cast).toBeNull();
    expect(seq.push('wu', 1400).cast).toBeNull();
    const result = seq.push('zi', 1800);
    expect(result.cast?.spell.id).toBe('fire');
  });

  it('resets the chain when a seal arrives too late', () => {
    const seq = new SealSequencer();
    seq.push('yin', 1000);
    seq.push('wu', 1400);
    // big gap → chain resets, 'zi' alone is not a spell prefix start that completes fire
    const result = seq.push('zi', 1800 + 9000);
    expect(result.cast).toBeNull();
  });

  it('self-recovers by dropping stale leading seals', () => {
    const seq = new SealSequencer();
    seq.push('yin', 1000); // prefix of fire
    // 'mao' breaks fire's prefix but starts wind (mao→yin)
    const p = seq.push('mao', 1300).progress;
    expect(p.chain).toEqual(['mao']);
    const cast = seq.push('yin', 1600).cast;
    expect(cast?.spell.id).toBe('wind');
  });
});
