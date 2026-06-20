import type { Landmark } from '../types';
import { extractHandPose } from './handFeatures';
import { SEALS, SEAL_FINGER_MASK, type Seal } from './sealTypes';

export interface SealResult {
  seal: Seal;
  confidence: number;
}

function popcount(n: number): number {
  let c = 0;
  let v = n;
  while (v) {
    c += v & 1;
    v >>= 1;
  }
  return c;
}

// Classify a hand into a seal by its 4-finger (index/middle/ring/pinky) extension mask.
// Exact match → high confidence; off-by-one (a transition between seals) → low so the
// stabilizer won't latch onto it.
export function classifySeal(hand: Landmark[] | undefined): SealResult | null {
  const pose = extractHandPose(hand ?? []);
  if (!pose) {
    return null;
  }
  const fingerMask = (pose.mask >> 1) & 0b1111; // drop the thumb bit
  let best: Seal | null = null;
  let bestDist = 99;
  for (const seal of SEALS) {
    const dist = popcount(fingerMask ^ SEAL_FINGER_MASK[seal]);
    if (dist < bestDist) {
      bestDist = dist;
      best = seal;
    }
  }
  if (!best) {
    return null;
  }
  const confidence = bestDist === 0 ? 0.9 : bestDist === 1 ? 0.55 : 0.3;
  return { seal: best, confidence };
}
