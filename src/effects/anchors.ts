import type { FrameFeatures, Landmark } from '../vision/types';
import { handOpenness } from '../vision/gestures';

// Overhaul P1 — resolve a live landmark anchor for attached (hand-following) effects.
// Positions/directions are in normalized video space; coordMap turns them into canvas px.

export type AttachAnchorKind =
  | 'hand_center'
  | 'hand_palm_dir'
  | 'fingertip_index'
  | 'palms_midpoint'
  | 'body_core';

export interface ResolvedAnchor {
  pos: { x: number; y: number };
  dir: { x: number; y: number };
  /** Effect-specific 0..1 driver: hand openness, palm closeness, shoulder width… */
  scalar: number;
  found: boolean;
}

const MISSING: ResolvedAnchor = {
  pos: { x: 0.5, y: 0.5 },
  dir: { x: 0, y: -1 },
  scalar: 0,
  found: false,
};

function sub(a: Landmark, b: Landmark) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mid(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function norm(v: { x: number; y: number }) {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-4 ? { x: 0, y: -1 } : { x: v.x / len, y: v.y / len };
}

function isVisible(p: Landmark | undefined): p is Landmark {
  return !!p && (p.visibility === undefined || p.visibility > 0.45);
}

export function resolveAnchor(
  kind: AttachAnchorKind,
  frame: FrameFeatures,
  handIndex = 0,
): ResolvedAnchor {
  const hand = frame.hands[handIndex];
  const handReady = hand && hand.length >= 21;

  switch (kind) {
    case 'hand_center':
    case 'hand_palm_dir': {
      if (!handReady) return MISSING;
      return {
        pos: { x: hand[9].x, y: hand[9].y },
        dir: norm(sub(hand[9], hand[0])),
        scalar: handOpenness(hand),
        found: true,
      };
    }
    case 'fingertip_index': {
      if (!handReady) return MISSING;
      return {
        pos: { x: hand[8].x, y: hand[8].y },
        dir: norm(sub(hand[8], hand[5])),
        scalar: 1,
        found: true,
      };
    }
    case 'palms_midpoint': {
      const a = frame.hands[0];
      const b = frame.hands[1];
      if (!a || !b || a.length < 21 || b.length < 21) return MISSING;
      const closeness = Math.max(0, Math.min(1, 1 - dist(a[0], b[0]) / 0.5));
      return {
        pos: mid(a[9], b[9]),
        dir: { x: 0, y: -1 },
        scalar: closeness,
        found: true,
      };
    }
    case 'body_core': {
      const ls = frame.pose[11];
      const rs = frame.pose[12];
      if (!isVisible(ls) || !isVisible(rs)) return MISSING;
      return {
        pos: mid(ls, rs),
        dir: { x: 0, y: -1 },
        scalar: dist(ls, rs),
        found: true,
      };
    }
    default:
      return MISSING;
  }
}
