import { SEAL_LABELS } from '../vision/seals/sealTypes';
import type { SealProgress } from '../play/seals';

interface SealChainHUDProps {
  progress: SealProgress | null;
  banner: { name: string; nonce: number } | null;
}

/**
 * v overhaul P4 — live seal-chain feedback: the seals结成 so far (highlighted), the next
 * possible seal (ghost hint) and the spell being worked toward, plus a cast banner.
 */
export function SealChainHUD({ progress, banner }: SealChainHUDProps) {
  const hasChain = !!progress && progress.chain.length > 0;
  if (!hasChain && !banner) {
    return null;
  }

  return (
    <div className="seal-hud" role="status" aria-live="polite">
      {hasChain ? (
        <>
          <div className="seal-chain">
            {progress!.chain.map((s, i) => (
              <span className="seal-slot done" key={`${s}-${i}`}>
                {SEAL_LABELS[s]}
              </span>
            ))}
            {progress!.nextSeals.slice(0, 1).map((s) => (
              <span className="seal-slot next" key={`next-${s}`}>
                {SEAL_LABELS[s]}
              </span>
            ))}
          </div>
          {progress!.candidates.length > 0 ? (
            <div className="seal-hint">
              {progress!.candidates[0].name}
              {progress!.nextSeals.length > 0
                ? ` · 下一印 ${progress!.nextSeals.map((s) => SEAL_LABELS[s]).join(' / ')}`
                : ''}
            </div>
          ) : null}
        </>
      ) : null}
      {banner ? (
        <div className="seal-banner" key={banner.nonce}>
          {banner.name}!
        </div>
      ) : null}
    </div>
  );
}
