// Overhaul P1 — the single source of truth for "where does a MediaPipe landmark land
// on the effect canvas". This is the most error-prone part of hand-following: the
// camera <video> is shown mirrored (CSS `transform: scaleX(-1)`) AND `object-fit: cover`
// crops it to fill the stage, while landmarks are normalized in the UNmirrored video
// frame. Both transient and attached effects route through here so they line up with
// the hand the user actually sees.

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Map a normalized landmark (0..1 in the unmirrored video frame) to a pixel position on
 * the effect canvas, accounting for the horizontal mirror and object-fit:cover crop.
 * The effect canvas uses an orthographic camera with y=0 at the top (matches MediaPipe's
 * top-down y), so no y flip is needed.
 */
export function coverMap(
  nx: number,
  ny: number,
  videoW: number,
  videoH: number,
  canvasW: number,
  canvasH: number,
): Vec2 {
  const vw = videoW > 0 ? videoW : canvasW;
  const vh = videoH > 0 ? videoH : canvasH;
  // The feed is mirrored on screen, so flip x to match what the user sees.
  const mx = 1 - nx;
  // object-fit: cover — scale so the video fills the canvas, cropping the overflow.
  const scale = Math.max(canvasW / vw, canvasH / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offsetX = (canvasW - dispW) / 2;
  const offsetY = (canvasH - dispH) / 2;
  return { x: mx * dispW + offsetX, y: ny * dispH + offsetY };
}

/**
 * Mirror a direction vector to match the mirrored feed (x flips, y stays). Used so
 * directional effects (beam/slash/shockwave) point the way the user expects on screen.
 */
export function mirrorDir(dir: Vec2): Vec2 {
  return { x: -dir.x, y: dir.y };
}
