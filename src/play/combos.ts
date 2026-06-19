import type { GestureKind } from '../vision/types';
import type { EffectKind } from '../effects/types';

// v0.9 — combos sit on top of the single-gesture stabilizer: a short sequence of
// gestures within a time window triggers a stronger composite "必杀". Because the
// sequences are made of distinct gesture kinds, each kind keeps its own cooldown and
// they aren't suppressed by the stabilizer.
export interface ComboDef {
  id: string;
  name: string;
  sequence: GestureKind[];
  windowMs: number;
  effect: EffectKind;
}

export const COMBOS: ComboDef[] = [
  {
    id: 'meteor',
    name: '陨星爆轰',
    sequence: ['charge_stance', 'push_palm'],
    windowMs: 2600,
    effect: 'shockwave',
  },
  {
    id: 'judgment',
    name: '天罚落雷',
    sequence: ['both_hands_raised', 'finger_point'],
    windowMs: 2600,
    effect: 'beam',
  },
  {
    id: 'guardbreak',
    name: '破盾斩',
    sequence: ['cross_guard', 'side_slash'],
    windowMs: 2600,
    effect: 'slash',
  },
  {
    id: 'risingdragon',
    name: '升龙爆气',
    sequence: ['crouch', 'jump'],
    windowMs: 2200,
    effect: 'aura_burst',
  },
];

export interface ComboHit {
  def: ComboDef;
  at: number;
}

export class ComboDetector {
  private history: { kind: GestureKind; at: number }[] = [];

  push(kind: GestureKind, at: number): ComboHit | null {
    this.history.push({ kind, at });
    if (this.history.length > 8) {
      this.history.shift();
    }
    for (const def of COMBOS) {
      if (this.matches(def, at)) {
        this.history = []; // consume so the same tail can't immediately re-fire
        return { def, at };
      }
    }
    return null;
  }

  private matches(def: ComboDef, now: number): boolean {
    const seq = def.sequence;
    if (this.history.length < seq.length) {
      return false;
    }
    const tail = this.history.slice(-seq.length);
    for (let i = 0; i < seq.length; i += 1) {
      if (tail[i].kind !== seq[i]) {
        return false;
      }
    }
    return now - tail[0].at <= def.windowMs;
  }

  reset() {
    this.history = [];
  }
}
