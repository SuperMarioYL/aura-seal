import type { Landmark } from '../types';
import { classifySeal } from './sealClassifier';
import type { Seal } from './sealTypes';

export interface SealEvent {
  seal: Seal;
  confidence: number;
  ts: number;
}

const CONFIRM_FRAMES = 3;
const MIN_CONFIDENCE = 0.6;

// Overhaul P4 — debounce raw per-frame seal guesses into stable seal events. A seal must
// hold for a few frames above the confidence floor; the same held seal emits once (no
// 1450ms gesture cooldown — seals need to be quick), and re-emits after the hand leaves
// the seal (so 子→子 via a release still works).
export class SealStabilizer {
  private candidate: Seal | null = null;
  private frames = 0;
  private emitted: Seal | null = null;

  push(hand: Landmark[] | undefined, ts: number): SealEvent | null {
    const res = classifySeal(hand);
    if (!res || res.confidence < MIN_CONFIDENCE) {
      this.candidate = null;
      this.frames = 0;
      this.emitted = null; // released — allow the same seal to fire again next time
      return null;
    }

    if (res.seal !== this.candidate) {
      this.candidate = res.seal;
      this.frames = 1;
      return null;
    }

    this.frames += 1;
    if (this.frames < CONFIRM_FRAMES || this.emitted === res.seal) {
      return null;
    }
    this.emitted = res.seal;
    return { seal: res.seal, confidence: res.confidence, ts };
  }

  /** The seal currently being held (confirmed), for live HUD feedback. */
  current(): Seal | null {
    return this.frames >= CONFIRM_FRAMES ? this.candidate : null;
  }

  reset() {
    this.candidate = null;
    this.frames = 0;
    this.emitted = null;
  }
}
