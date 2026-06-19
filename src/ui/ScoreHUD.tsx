import { Flame, Trophy } from 'lucide-react';
import type { ScoreState } from '../play/scoring';
import type { ComboBanner, RatingFlash } from '../play/usePlay';

interface ScoreHUDProps {
  score: ScoreState;
  flash: RatingFlash | null;
  combo: ComboBanner | null;
}

export function ScoreHUD({ score, flash, combo }: ScoreHUDProps) {
  return (
    <div className="score-hud" aria-live="polite">
      <div className="score-main">
        <span className="score-value">{score.score.toLocaleString()}</span>
        <span className="score-best">
          <Trophy size={12} /> {score.best.toLocaleString()}
        </span>
      </div>

      {score.combo > 1 ? (
        <div className="score-combo">
          <Flame size={14} />×{score.combo} 连击
        </div>
      ) : null}

      {flash ? (
        <div className={`score-flash rating-${flash.rating.toLowerCase()}`} key={flash.nonce}>
          +{flash.gained} {flash.rating}
        </div>
      ) : null}

      {combo ? (
        <div className="combo-banner" key={combo.nonce}>
          {combo.name}!
        </div>
      ) : null}
    </div>
  );
}
