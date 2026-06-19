import { useCallback, useRef, useState } from 'react';
import type { EffectKind } from '../effects/types';
import type { GestureEvent } from '../vision/types';
import { ComboDetector } from './combos';
import { INITIAL_SCORE, registerHit, type Rating, type ScoreState } from './scoring';

const LS_BEST = 'auraseal.best';
const COMBO_BONUS = 3;

function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(LS_BEST));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number) {
  try {
    localStorage.setItem(LS_BEST, String(best));
  } catch {
    // ignore
  }
}

export interface RatingFlash {
  rating: Rating;
  gained: number;
  nonce: number;
}

export interface ComboBanner {
  name: string;
  nonce: number;
}

/**
 * v0.9 gameplay glue: turns each landed gesture into score/combo, detects combo
 * sequences (returning a stronger composite effect to cast), and persists the best.
 */
export function usePlay() {
  const scoreRef = useRef<ScoreState>({ ...INITIAL_SCORE, best: loadBest() });
  const comboRef = useRef(new ComboDetector());
  const [score, setScore] = useState<ScoreState>(scoreRef.current);
  const [flash, setFlash] = useState<RatingFlash | null>(null);
  const [combo, setCombo] = useState<ComboBanner | null>(null);

  const onGesture = useCallback((gesture: GestureEvent): EffectKind | null => {
    const hit = registerHit(scoreRef.current, gesture.confidence, gesture.timestampMs);
    scoreRef.current = hit.state;
    setFlash({ rating: hit.rating, gained: hit.gained, nonce: performance.now() });

    const comboHit = comboRef.current.push(gesture.kind, gesture.timestampMs);
    let comboEffect: EffectKind | null = null;
    if (comboHit) {
      const bonus = registerHit(scoreRef.current, 1, gesture.timestampMs + 1, COMBO_BONUS);
      scoreRef.current = bonus.state;
      comboEffect = comboHit.def.effect;
      setCombo({ name: comboHit.def.name, nonce: performance.now() });
    }

    setScore(scoreRef.current);
    saveBest(scoreRef.current.best);
    return comboEffect;
  }, []);

  const reset = useCallback(() => {
    comboRef.current.reset();
    scoreRef.current = { ...INITIAL_SCORE, best: scoreRef.current.best };
    setScore(scoreRef.current);
    setFlash(null);
    setCombo(null);
  }, []);

  return { score, flash, combo, onGesture, reset };
}
