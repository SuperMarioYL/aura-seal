import {
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Flame,
  Hand,
  Pointer,
  Shield,
  Sparkles,
  Sun,
  Sword,
  Swords,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { GestureKind } from '../vision/types';

// Lightweight dark-theme vector glyph per gesture — replaces the 1.77MB white-background
// guide image that clashed with the dark UI. A richer interactive Lottie/SVG set lands in v0.8.
const GLYPHS: Record<GestureKind, LucideIcon> = {
  palms_joined: Sparkles,
  push_palm: Hand,
  charge_stance: Flame,
  punch: Zap,
  raised_hand: ArrowUp,
  crouch: ChevronsDown,
  jump: ChevronsUp,
  cross_guard: Shield,
  both_hands_raised: Sun,
  guard_stance: Swords,
  finger_point: Pointer,
  side_slash: Sword,
};

export function gestureIcon(kind: GestureKind): LucideIcon {
  return GLYPHS[kind] ?? Sparkles;
}
