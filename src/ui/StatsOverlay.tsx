import type { VisionSnapshot } from '../vision/types';

interface StatsOverlayProps {
  snapshot: VisionSnapshot;
  quality: number;
  degraded: boolean;
}

/**
 * v1.0 — developer stats overlay (toggle with Shift+D). Hidden by default so the
 * normal UI isn't a dashboard; surfaces fps / quality tier / detection counts.
 */
export function StatsOverlay({ snapshot, quality, degraded }: StatsOverlayProps) {
  return (
    <div className="stats-overlay" aria-hidden="true">
      <div>
        FPS <b>{snapshot.fps || '--'}</b>
      </div>
      <div>
        QLT <b>{quality}</b>
      </div>
      <div>
        HAND <b>{snapshot.detectedHands}</b>
      </div>
      <div>
        POSE <b>{snapshot.hasPose ? 'Y' : 'N'}</b>
      </div>
      {degraded ? <div className="warn">hand-only</div> : null}
    </div>
  );
}
