import type { Landmark } from '../types';

// Overhaul P4 — per-finger pose features for 结印 (hand-seal) recognition. The robust,
// orientation-independent signal is which fingers are extended vs curled, derived from
// the straightness (joint angle) of each finger. A 5-bit mask [thumb,index,middle,ring,
// pinky] is the primary discriminator; flexion angles give a confidence signal.

export interface HandPose {
  /** Per finger: true if extended/straight. Order: thumb, index, middle, ring, pinky. */
  extended: boolean[];
  /** 5-bit mask of `extended` (bit0 = thumb … bit4 = pinky). */
  mask: number;
  /** Per finger straightness 0..1 (1 = perfectly straight). */
  flexion: number[];
}

// (joint a, vertex b, joint c) per finger — angle at b is the finger's straightness.
const FINGERS: Array<[number, number, number]> = [
  [2, 3, 4], // thumb (mcp, ip, tip)
  [5, 6, 8], // index (mcp, pip, tip)
  [9, 10, 12], // middle
  [13, 14, 16], // ring
  [17, 18, 20], // pinky
];

// Straightness threshold (radians). Straight finger ≈ π; curled ≈ 1.3–2.0.
const EXTENDED_THUMB = 2.55;
const EXTENDED_FINGER = 2.3;

function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (len < 1e-6) {
    return Math.PI;
  }
  return Math.acos(Math.min(1, Math.max(-1, dot / len)));
}

export function extractHandPose(hand: Landmark[]): HandPose | null {
  if (!hand || hand.length < 21) {
    return null;
  }
  const extended: boolean[] = [];
  const flexion: number[] = [];
  let mask = 0;
  for (let i = 0; i < FINGERS.length; i += 1) {
    const [a, b, c] = FINGERS[i];
    const angle = angleAt(hand[a], hand[b], hand[c]);
    flexion.push(Math.min(1, angle / Math.PI));
    const isExt = angle > (i === 0 ? EXTENDED_THUMB : EXTENDED_FINGER);
    extended.push(isExt);
    if (isExt) {
      mask |= 1 << i;
    }
  }
  return { extended, mask, flexion };
}
