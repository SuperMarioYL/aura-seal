// v0.9 — lightweight scoring so casting has a feedback loop (score / combo / rating)
// and a reason to keep going. Pure reducer; persistence lives in the hook.

export type Rating = 'GOOD' | 'GREAT' | 'PERFECT';

export interface ScoreState {
  score: number;
  combo: number;
  best: number;
  lastAt: number;
}

export const INITIAL_SCORE: ScoreState = { score: 0, combo: 0, best: 0, lastAt: -Infinity };

const COMBO_WINDOW_MS = 2500;
const COMBO_MULT_STEP = 0.15;
const COMBO_MULT_MAX = 4;
const RATING_MULT: Record<Rating, number> = { GOOD: 1, GREAT: 1.5, PERFECT: 2 };

export function ratingFor(confidence: number): Rating {
  if (confidence >= 0.85) {
    return 'PERFECT';
  }
  if (confidence >= 0.62) {
    return 'GREAT';
  }
  return 'GOOD';
}

export interface HitResult {
  state: ScoreState;
  gained: number;
  rating: Rating;
  comboMult: number;
}

/**
 * Register a successful cast. Combo grows while casts stay within the window and
 * resets after a lull. Bonus multiplies the base points (used for combo ultimates).
 */
export function registerHit(
  state: ScoreState,
  confidence: number,
  now: number,
  bonus = 1,
): HitResult {
  const combo = now - state.lastAt <= COMBO_WINDOW_MS ? state.combo + 1 : 1;
  const rating = ratingFor(confidence);
  const comboMult = Math.min(1 + (combo - 1) * COMBO_MULT_STEP, COMBO_MULT_MAX);
  const gained = Math.round(100 * RATING_MULT[rating] * comboMult * bonus);
  const score = state.score + gained;
  return {
    state: { score, combo, best: Math.max(state.best, score), lastAt: now },
    gained,
    rating,
    comboMult,
  };
}
