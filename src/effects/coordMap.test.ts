import { describe, expect, it } from 'vitest';
import { coverMap, mirrorDir } from './coordMap';

describe('coverMap', () => {
  it('mirrors x: a landmark on the left of the frame lands on the right of the canvas', () => {
    // Same aspect (16:9 → 16:9), no crop, so it is a pure mirror.
    const p = coverMap(0.2, 0.5, 1280, 720, 1280, 720);
    expect(p.x).toBeCloseTo(1024); // (1 - 0.2) * 1280
    expect(p.y).toBeCloseTo(360);
  });

  it('keeps center at center regardless of crop', () => {
    const p = coverMap(0.5, 0.5, 1280, 720, 800, 800);
    expect(p.x).toBeCloseTo(400);
    expect(p.y).toBeCloseTo(400);
  });

  it('cover-crops the longer axis (landscape video into a square canvas)', () => {
    // 1280x720 into 720x720: scale = max(720/1280, 720/720) = 1 → dispW=1280, cropped sideways.
    const p = coverMap(0.5, 0, 1280, 720, 720, 720);
    // center x stays centered; top of video maps to canvas top (no vertical crop here).
    expect(p.x).toBeCloseTo(360);
    expect(p.y).toBeCloseTo(0);
    // a point at video-left edge after mirror is at the right, pushed off-canvas by the crop.
    const left = coverMap(0, 0.5, 1280, 720, 720, 720);
    expect(left.x).toBeGreaterThan(720); // mirrored to the right and cropped beyond the edge
  });

  it('falls back to canvas dims when video size is unknown', () => {
    const p = coverMap(0.25, 0.25, 0, 0, 1000, 800);
    expect(p.x).toBeCloseTo(750); // (1 - 0.25) * 1000
    expect(p.y).toBeCloseTo(200);
  });

  it('mirrorDir flips x only', () => {
    expect(mirrorDir({ x: 1, y: -0.2 })).toEqual({ x: -1, y: -0.2 });
  });
});
