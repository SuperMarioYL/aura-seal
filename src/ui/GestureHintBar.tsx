import { Sparkles } from 'lucide-react';
import type { AppMode, GestureEvent, VisionSnapshot } from '../vision/types';
import type { CameraStatus } from '../app/useCamera';
import { GESTURE_LABELS } from '../vision/types';
import { guideForGesture } from '../vision/gestureGuides';
import { gestureIcon } from './gestureIcons';

interface GestureHintBarProps {
  cameraStatus: CameraStatus;
  mode: AppMode;
  snapshot: VisionSnapshot;
  latestGesture: GestureEvent | null;
  degraded: boolean;
}

/**
 * Persistent guidance after the camera starts — replaces the previous "empty room"
 * (a bare video feed with two cryptic labels). Tells the user what to try and shows
 * live evidence that the system can see them, using the data the loop already produces.
 */
export function GestureHintBar({
  cameraStatus,
  mode,
  snapshot,
  latestGesture,
  degraded,
}: GestureHintBarProps) {
  if (cameraStatus !== 'ready' || mode !== 'auto') {
    return null;
  }

  // In hand-only (degraded) mode suggest a hand gesture; otherwise an easy pose gesture.
  const suggestedKind = degraded ? 'palms_joined' : 'raised_hand';
  const guide = guideForGesture(suggestedKind);

  const readiness = degraded
    ? Math.min(100, (snapshot.detectedHands / 2) * 100)
    : (snapshot.hasPose ? 60 : 0) + (snapshot.detectedHands > 0 ? 40 : 0);

  let title: string;
  let detail: string;
  if (latestGesture) {
    title = `已触发「${latestGesture.label}」`;
    detail = '很好,继续下一招或换一个动作';
  } else if (readiness === 0) {
    title = '把上半身放进画面';
    detail = '保持光线充足、稍微退后一点,让头和手都入镜';
  } else {
    title = `试试「${GESTURE_LABELS[suggestedKind]}」`;
    detail = guide.shortInstruction;
  }

  const Icon = latestGesture ? Sparkles : gestureIcon(suggestedKind);

  return (
    <div className="gesture-hint-bar" role="status" aria-live="polite">
      <span className="hint-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="hint-text">
        {title}
        <small>{detail}</small>
      </div>
      <div className="hint-progress" aria-hidden="true">
        <i style={{ width: `${Math.round(readiness)}%` }} />
      </div>
    </div>
  );
}
