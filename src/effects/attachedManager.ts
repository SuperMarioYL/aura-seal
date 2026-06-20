import type { FrameFeatures } from '../vision/types';
import type { AttachAnchorKind } from './anchors';
import { resolveAnchor } from './anchors';

// Overhaul P2 — decide which hand-following effects should exist this frame, with
// STABLE ids (keyed by handedness, not array index) so left/right effects don't swap
// when MediaPipe reorders the hand array. The EffectCanvas draw loop diffs this list
// against the live actors to create / update / fade-out.

export type AttachedFactory = 'aura_ring' | 'palm_orb' | 'finger_trail' | 'body_aura';

export interface AttachedSpec {
  id: string;
  factory: AttachedFactory;
  anchorKind: AttachAnchorKind;
  handIndex: number; // index into frame.hands; ignored for non-hand anchors
}

const ORB_CLOSENESS = 0.45; // palms must be at least this close to show the orb

function side(frame: FrameFeatures, i: number): string {
  const h = frame.handedness[i];
  return h === 'Left' ? 'L' : h === 'Right' ? 'R' : `H${i}`;
}

export function planAttached(frame: FrameFeatures, quality = 0): AttachedSpec[] {
  const specs: AttachedSpec[] = [];
  const hands = frame.hands;
  const handCount = Math.min(hands.length, 2);

  for (let i = 0; i < handCount; i += 1) {
    const s = side(frame, i);
    specs.push({ id: `aura:${s}`, factory: 'aura_ring', anchorKind: 'hand_center', handIndex: i });
    if (quality < 2) {
      specs.push({
        id: `trail:${s}`,
        factory: 'finger_trail',
        anchorKind: 'fingertip_index',
        handIndex: i,
      });
    }
  }

  if (hands.length >= 2) {
    const orb = resolveAnchor('palms_midpoint', frame);
    if (orb.found && orb.scalar >= ORB_CLOSENESS) {
      specs.push({ id: 'orb', factory: 'palm_orb', anchorKind: 'palms_midpoint', handIndex: -1 });
    }
  }

  // Body aura only while "powering up" (both wrists above shoulders) — keeps it from
  // being an always-on shell. Skipped on low quality.
  const pose = frame.pose;
  if (quality < 2 && pose.length >= 17) {
    const ls = pose[11];
    const rs = pose[12];
    const lw = pose[15];
    const rw = pose[16];
    const poweringUp =
      lw && rw && ls && rs && lw.y < ls.y && rw.y < rs.y && (lw.visibility ?? 1) > 0.4;
    if (poweringUp) {
      specs.push({ id: 'body', factory: 'body_aura', anchorKind: 'body_core', handIndex: -1 });
    }
  }

  return specs;
}
