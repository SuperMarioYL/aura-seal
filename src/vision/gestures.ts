import {
  GESTURE_LABELS,
  type FrameFeatures,
  type GestureCandidate,
  type GestureEvent,
  type GestureKind,
  type Landmark,
} from './types';

const COOLDOWN_MS = 1450;
const REQUIRED_FRAMES = 5;

export class GestureStabilizer {
  private current: GestureCandidate | null = null;
  private currentStartedAt = 0;
  private currentFrames = 0;
  private lastFrame: FrameFeatures | null = null;
  private lastEmitted = new Map<GestureKind, number>();

  push(frame: FrameFeatures): GestureEvent | null {
    const candidate = evaluateGesture(frame, this.lastFrame);
    this.lastFrame = frame;

    if (!candidate) {
      this.current = null;
      this.currentFrames = 0;
      return null;
    }

    if (this.current?.kind !== candidate.kind) {
      this.current = candidate;
      this.currentStartedAt = frame.timestampMs;
      this.currentFrames = 1;
      return null;
    }

    this.current = {
      ...candidate,
      confidence: this.current.confidence * 0.45 + candidate.confidence * 0.55,
      anchor: candidate.anchor,
    };
    this.currentFrames += 1;

    const lastTime = this.lastEmitted.get(candidate.kind) ?? -Infinity;
    if (frame.timestampMs - lastTime < COOLDOWN_MS || this.currentFrames < REQUIRED_FRAMES) {
      return null;
    }

    this.lastEmitted.set(candidate.kind, frame.timestampMs);
    const durationMs = frame.timestampMs - this.currentStartedAt;
    return {
      id: `${candidate.kind}-${Math.round(frame.timestampMs)}`,
      kind: candidate.kind,
      label: GESTURE_LABELS[candidate.kind],
      confidence: clamp(this.current.confidence, 0, 1),
      anchor: candidate.anchor,
      secondaryAnchor: candidate.secondaryAnchor,
      direction: candidate.direction,
      durationMs,
      timestampMs: frame.timestampMs,
    };
  }

  reset() {
    this.current = null;
    this.currentStartedAt = 0;
    this.currentFrames = 0;
    this.lastFrame = null;
    this.lastEmitted.clear();
  }
}

export function evaluateGesture(
  frame: FrameFeatures,
  previous: FrameFeatures | null = null,
): GestureCandidate | null {
  const detectors: Array<() => GestureCandidate | null> = [
    () => detectPalmsJoined(frame),
    () => detectCrossGuard(frame),
    () => detectBothHandsRaised(frame),
    () => detectRaisedHand(frame),
    () => detectJump(frame, previous),
    () => detectCrouch(frame),
    () => detectGuardStance(frame),
    () => detectChargeStance(frame),
    () => detectFingerPoint(frame),
    () => detectSideSlash(frame),
    () => detectPushPalm(frame),
    () => detectPunch(frame),
  ];

  for (const detect of detectors) {
    const candidate = detect();
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function detectPalmsJoined(frame: FrameFeatures): GestureCandidate | null {
  if (frame.hands.length < 2) {
    return null;
  }

  const [first, second] = frame.hands;
  const wristGap = distance(first[0], second[0]);
  const indexGap = distance(first[8], second[8]);
  const middleGap = distance(first[12], second[12]);
  const anchor = midpoint(first[8], second[8]);
  const confidence = 1 - (wristGap + indexGap + middleGap) / 0.62;

  if (
    wristGap < 0.24 &&
    indexGap < 0.18 &&
    middleGap < 0.18 &&
    anchor.y > 0.24 &&
    anchor.y < 0.72
  ) {
    return {
      kind: 'palms_joined',
      confidence: clamp(confidence),
      anchor,
      secondaryAnchor: midpoint(first[0], second[0]),
      direction: { x: 0, y: -1 },
    };
  }

  return null;
}

function detectPushPalm(frame: FrameFeatures): GestureCandidate | null {
  const openHands = frame.hands
    .map((hand) => ({ hand, openness: handOpenness(hand) }))
    .filter((entry) => entry.openness > 0.42);

  if (openHands.length === 0) {
    return null;
  }

  const best = openHands.sort((a, b) => b.openness - a.openness)[0];
  const anchor = best.hand[9] ?? best.hand[0];
  const wrist = best.hand[0];
  const centered = 1 - Math.abs(anchor.x - 0.5) * 1.6;
  if (anchor.y > 0.18 && anchor.y < 0.72 && centered > 0.34) {
    return {
      kind: 'push_palm',
      confidence: clamp(best.openness * 0.72 + centered * 0.28),
      anchor,
      secondaryAnchor: wrist,
      direction: normalize({ x: anchor.x - wrist.x, y: anchor.y - wrist.y }),
    };
  }

  return null;
}

function detectChargeStance(frame: FrameFeatures): GestureCandidate | null {
  if (frame.hands.length < 2) {
    return null;
  }

  const wristA = frame.hands[0][0];
  const wristB = frame.hands[1][0];
  const anchor = midpoint(wristA, wristB);
  const close = 1 - distance(wristA, wristB) / 0.38;
  const torsoBand = anchor.y > 0.42 && anchor.y < 0.82;

  if (close > 0.28 && torsoBand) {
    return {
      kind: 'charge_stance',
      confidence: clamp(close * 0.8 + 0.18),
      anchor,
      secondaryAnchor: midpoint(frame.hands[0][9], frame.hands[1][9]),
      direction: { x: 0, y: -1 },
    };
  }

  return null;
}

function detectPunch(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const options = [
    { shoulder: pose[11], elbow: pose[13], wrist: pose[15] },
    { shoulder: pose[12], elbow: pose[14], wrist: pose[16] },
  ];

  const extended = options
    .map((side) => {
      const armLength = distance(side.shoulder, side.elbow) + distance(side.elbow, side.wrist);
      const reach = distance(side.shoulder, side.wrist);
      const extension = reach / Math.max(armLength, 0.001);
      return { ...side, extension };
    })
    .filter((side) => side.extension > 0.82 && side.wrist.y > 0.18 && side.wrist.y < 0.72);

  if (extended.length === 0) {
    return null;
  }

  const best = extended.sort((a, b) => b.extension - a.extension)[0];
  return {
    kind: 'punch',
    confidence: clamp((best.extension - 0.72) / 0.28),
    anchor: best.wrist,
    secondaryAnchor: best.shoulder,
    direction: normalize({ x: best.wrist.x - best.shoulder.x, y: best.wrist.y - best.shoulder.y }),
  };
}

function detectRaisedHand(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const nose = pose[0];
  const wrists = [pose[15], pose[16]].filter(isVisible);
  const raised = wrists.filter((wrist) => wrist.y < nose.y - 0.04);
  if (raised.length === 0) {
    return null;
  }

  const wrist = raised.sort((a, b) => a.y - b.y)[0];
  return {
    kind: 'raised_hand',
    confidence: clamp((nose.y - wrist.y + 0.04) / 0.36),
    anchor: wrist,
    secondaryAnchor: nose,
    direction: { x: 0, y: -1 },
  };
}

function detectBothHandsRaised(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const nose = pose[0];
  const wrists = [pose[15], pose[16]].filter(isVisible);
  if (wrists.length < 2) {
    return null;
  }

  const bothRaised = wrists.every((wrist) => wrist.y < nose.y - 0.03);
  if (!bothRaised) {
    return null;
  }

  return {
    kind: 'both_hands_raised',
    confidence: clamp(average(wrists.map((wrist) => nose.y - wrist.y + 0.05)) / 0.32),
    anchor: midpoint(wrists[0], wrists[1]),
    secondaryAnchor: nose,
    direction: { x: 0, y: -1 },
  };
}

function detectCrossGuard(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const leftWrist = pose[15];
  const rightWrist = pose[16];
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  if (![leftWrist, rightWrist, leftShoulder, rightShoulder].every(isVisible)) {
    return null;
  }

  const chest = midpoint(leftShoulder, rightShoulder);
  const wristGap = distance(leftWrist, rightWrist);
  const chestDistance = (distance(leftWrist, chest) + distance(rightWrist, chest)) / 2;
  const crossed = leftWrist.x > rightWrist.x;

  if (
    crossed &&
    wristGap < 0.24 &&
    chestDistance < 0.26 &&
    leftWrist.y > 0.18 &&
    leftWrist.y < 0.68
  ) {
    return {
      kind: 'cross_guard',
      confidence: clamp(1 - wristGap * 1.7 - chestDistance * 0.7),
      anchor: midpoint(leftWrist, rightWrist),
      secondaryAnchor: chest,
      direction: { x: 0, y: -1 },
    };
  }

  return null;
}

function detectGuardStance(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const shoulders = [pose[11], pose[12]].filter(isVisible);
  const elbows = [pose[13], pose[14]].filter(isVisible);
  const wrists = [pose[15], pose[16]].filter(isVisible);
  if (shoulders.length < 2 || elbows.length < 2 || wrists.length < 2) {
    return null;
  }

  const shoulderMid = midpoint(shoulders[0], shoulders[1]);
  const wristMid = midpoint(wrists[0], wrists[1]);
  const wristsNearFace = wrists.every(
    (wrist) => wrist.y > shoulderMid.y - 0.12 && wrist.y < shoulderMid.y + 0.28,
  );
  const elbowsBent = wrists.every((wrist, index) => distance(wrist, elbows[index]) < 0.22);
  const spread = distance(wrists[0], wrists[1]);

  if (wristsNearFace && elbowsBent && spread > 0.12 && spread < 0.46) {
    return {
      kind: 'guard_stance',
      confidence: clamp(0.58 + (0.46 - spread) * 0.8),
      anchor: wristMid,
      secondaryAnchor: shoulderMid,
      direction: { x: 0, y: -1 },
    };
  }

  return null;
}

function detectFingerPoint(frame: FrameFeatures): GestureCandidate | null {
  for (const hand of frame.hands) {
    if (hand.length < 21) {
      continue;
    }

    const indexExtension = distance(hand[8], hand[5]);
    const middleCurl = distance(hand[12], hand[9]);
    const ringCurl = distance(hand[16], hand[13]);
    const pinkyCurl = distance(hand[20], hand[17]);
    const indexLeads =
      indexExtension > middleCurl * 1.25 &&
      indexExtension > ringCurl * 1.25 &&
      indexExtension > pinkyCurl * 1.25;

    if (indexLeads && hand[8].y > 0.12 && hand[8].y < 0.72) {
      return {
        kind: 'finger_point',
        confidence: clamp((indexExtension - Math.max(middleCurl, ringCurl, pinkyCurl)) * 5 + 0.55),
        anchor: hand[8],
        secondaryAnchor: hand[5],
        direction: normalize({ x: hand[8].x - hand[5].x, y: hand[8].y - hand[5].y }),
      };
    }
  }

  return null;
}

function detectSideSlash(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 17) {
    return null;
  }

  const candidates = [
    { shoulder: pose[11], wrist: pose[15] },
    { shoulder: pose[12], wrist: pose[16] },
  ].filter((entry) => isVisible(entry.shoulder) && isVisible(entry.wrist));

  for (const entry of candidates) {
    const horizontalReach = Math.abs(entry.wrist.x - entry.shoulder.x);
    const verticalDrift = Math.abs(entry.wrist.y - entry.shoulder.y);
    if (
      horizontalReach > 0.28 &&
      verticalDrift < 0.16 &&
      entry.wrist.y > 0.2 &&
      entry.wrist.y < 0.66
    ) {
      return {
        kind: 'side_slash',
        confidence: clamp(horizontalReach * 1.8 - verticalDrift),
        anchor: entry.wrist,
        secondaryAnchor: entry.shoulder,
        direction: normalize({
          x: entry.wrist.x - entry.shoulder.x,
          y: entry.wrist.y - entry.shoulder.y,
        }),
      };
    }
  }

  return null;
}

function detectCrouch(frame: FrameFeatures): GestureCandidate | null {
  const pose = frame.pose;
  if (pose.length < 29) {
    return null;
  }

  const hips = [pose[23], pose[24]].filter(isVisible);
  const knees = [pose[25], pose[26]].filter(isVisible);
  if (hips.length < 2 || knees.length < 2) {
    return null;
  }

  const hipY = average(hips.map((point) => point.y));
  const kneeY = average(knees.map((point) => point.y));
  const compressed = kneeY - hipY;
  if (hipY > 0.52 && compressed < 0.24) {
    return {
      kind: 'crouch',
      confidence: clamp((0.28 - compressed) / 0.28 + (hipY - 0.48) * 0.7),
      anchor: { x: average(hips.map((point) => point.x)), y: hipY },
      secondaryAnchor: { x: average(knees.map((point) => point.x)), y: kneeY },
      direction: { x: 0, y: 1 },
    };
  }

  return null;
}

function detectJump(frame: FrameFeatures, previous: FrameFeatures | null): GestureCandidate | null {
  if (!previous || frame.pose.length < 29 || previous.pose.length < 29) {
    return null;
  }

  const hips = [frame.pose[23], frame.pose[24]].filter(isVisible);
  const previousHips = [previous.pose[23], previous.pose[24]].filter(isVisible);
  const ankles = [frame.pose[27], frame.pose[28]].filter(isVisible);
  if (hips.length < 2 || previousHips.length < 2 || ankles.length < 2) {
    return null;
  }

  const hipY = average(hips.map((point) => point.y));
  const previousHipY = average(previousHips.map((point) => point.y));
  const lift = previousHipY - hipY;
  const ankleY = average(ankles.map((point) => point.y));

  if (lift > 0.036 && ankleY < 0.92) {
    return {
      kind: 'jump',
      confidence: clamp(lift / 0.12),
      anchor: { x: average(hips.map((point) => point.x)), y: hipY + 0.12 },
      secondaryAnchor: { x: average(ankles.map((point) => point.x)), y: ankleY },
      direction: { x: 0, y: 1 },
    };
  }

  return null;
}

export function handOpenness(hand: Landmark[]): number {
  if (hand.length < 21) {
    return 0;
  }

  const wrist = hand[0];
  const tips = [hand[4], hand[8], hand[12], hand[16], hand[20]];
  const palmCenter = hand[9];
  const spread = distance(hand[4], hand[20]);
  const extension = average(tips.map((tip) => distance(tip, wrist)));
  const palmReach = distance(palmCenter, wrist);
  return clamp(spread * 1.8 + extension * 1.25 + palmReach * 0.7);
}

function midpoint(a: Landmark, b: Landmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function normalize(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function isVisible(point: Landmark): boolean {
  return point.visibility === undefined || point.visibility > 0.45;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}
