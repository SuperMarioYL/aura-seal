import type { GestureKind } from '../vision/types';
import { gestureIcon } from './gestureIcons';

export function GestureGlyph({ kind, size = 22 }: { kind: GestureKind; size?: number }) {
  const Icon = gestureIcon(kind);
  return (
    <span className="gesture-glyph" aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
