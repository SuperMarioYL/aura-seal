export type GestureKind =
  | 'palms_joined'
  | 'push_palm'
  | 'charge_stance'
  | 'punch'
  | 'raised_hand'
  | 'crouch'
  | 'jump'
  | 'cross_guard'
  | 'both_hands_raised'
  | 'guard_stance'
  | 'finger_point'
  | 'side_slash';

export type AppMode = 'auto' | 'manual';

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FrameFeatures {
  hands: Landmark[][];
  handedness: string[];
  pose: Landmark[];
  timestampMs: number;
  videoWidth: number;
  videoHeight: number;
}

export interface GestureEvent {
  id: string;
  kind: GestureKind;
  label: string;
  confidence: number;
  anchor: { x: number; y: number };
  secondaryAnchor?: { x: number; y: number };
  direction?: { x: number; y: number };
  durationMs: number;
  timestampMs: number;
}

export interface GestureCandidate {
  kind: GestureKind;
  confidence: number;
  anchor: { x: number; y: number };
  secondaryAnchor?: { x: number; y: number };
  direction?: { x: number; y: number };
}

export interface VisionSnapshot {
  frame: FrameFeatures | null;
  gesture: GestureEvent | null;
  fps: number;
  detectedHands: number;
  hasPose: boolean;
}

export const GESTURE_LABELS: Record<GestureKind, string> = {
  palms_joined: '双手合十',
  push_palm: '推掌',
  charge_stance: '蓄力姿势',
  punch: '挥拳',
  raised_hand: '举手',
  crouch: '蹲下',
  jump: '跳跃',
  cross_guard: '交叉防御',
  both_hands_raised: '双手举起',
  guard_stance: '格斗架势',
  finger_point: '指向',
  side_slash: '横扫',
};
