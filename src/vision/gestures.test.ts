import { describe, expect, it } from 'vitest';
import { GestureStabilizer, evaluateGesture } from './gestures';
import type { FrameFeatures, Landmark } from './types';

describe('evaluateGesture', () => {
  it('detects palms joined from two close hands', () => {
    const frame = frameWithHands([handAt(0.43, 0.48), handAt(0.52, 0.49)]);

    expect(evaluateGesture(frame)?.kind).toBe('palms_joined');
  });

  it('detects raised hand from pose wrist above nose', () => {
    const frame = frameWithPose({
      0: point(0.5, 0.24, 0.9),
      15: point(0.38, 0.12, 0.92),
      16: point(0.62, 0.48, 0.92),
    });

    expect(evaluateGesture(frame)?.kind).toBe('raised_hand');
  });

  it('detects both hands raised before single raised hand', () => {
    const frame = frameWithPose({
      0: point(0.5, 0.3, 0.9),
      15: point(0.38, 0.14, 0.92),
      16: point(0.62, 0.13, 0.92),
    });

    expect(evaluateGesture(frame)?.kind).toBe('both_hands_raised');
  });

  it('detects crossed forearm guard near the chest', () => {
    const frame = frameWithPose({
      11: point(0.42, 0.38, 0.9),
      12: point(0.58, 0.38, 0.9),
      15: point(0.56, 0.43, 0.92),
      16: point(0.44, 0.43, 0.92),
    });

    expect(evaluateGesture(frame)?.kind).toBe('cross_guard');
  });

  it('stabilizes gesture before emitting event and applies cooldown', () => {
    const stabilizer = new GestureStabilizer();
    const frames = Array.from({ length: 7 }, (_, index) =>
      frameWithHands([handAt(0.43, 0.48), handAt(0.52, 0.49)], 1000 + index * 34),
    );

    const emissions = frames.map((frame) => stabilizer.push(frame)).filter(Boolean);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]?.label).toBe('双手合十');

    const blocked = stabilizer.push(frameWithHands([handAt(0.43, 0.48), handAt(0.52, 0.49)], 1200));
    expect(blocked).toBeNull();
  });
});

function frameWithHands(hands: Landmark[][], timestampMs = 1000): FrameFeatures {
  return {
    hands,
    handedness: [],
    pose: [],
    timestampMs,
    videoWidth: 1280,
    videoHeight: 720,
  };
}

function frameWithPose(points: Record<number, Landmark>, timestampMs = 1000): FrameFeatures {
  const pose = Array.from({ length: 33 }, (_, index) => points[index] ?? point(0.5, 0.5, 0.2));
  return {
    hands: [],
    handedness: [],
    pose,
    timestampMs,
    videoWidth: 1280,
    videoHeight: 720,
  };
}

function handAt(x: number, y: number): Landmark[] {
  return Array.from({ length: 21 }, (_, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return point(x + column * 0.012, y + row * 0.01, 0.9);
  });
}

function point(x: number, y: number, visibility?: number): Landmark {
  return { x, y, visibility };
}
