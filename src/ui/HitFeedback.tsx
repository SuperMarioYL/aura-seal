import { useEffect, type CSSProperties, type RefObject } from 'react';

interface HitFeedbackProps {
  /** Changes on every cast — used as a key to restart the one-shot animation. */
  nonce: number;
  color: string;
  /** The stage to shake on impact (camera feed + effects). */
  shakeTarget: RefObject<HTMLElement | null>;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * v0.6 — screen-level impact response so an effect reads as "打在画面上" rather than
 * sitting next to it: a brief tinted flash + expanding shockring + a short camera
 * shake on each cast. Honours prefers-reduced-motion.
 */
export function HitFeedback({ nonce, color, shakeTarget }: HitFeedbackProps) {
  useEffect(() => {
    const el = shakeTarget.current;
    if (!nonce || !el || typeof el.animate !== 'function' || prefersReducedMotion()) {
      return;
    }
    const anim = el.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(5px, -3px)' },
        { transform: 'translate(-4px, 3px)' },
        { transform: 'translate(3px, 2px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
    return () => anim.cancel();
  }, [nonce, shakeTarget]);

  if (!nonce) {
    return null;
  }
  const style = { '--hit-color': color } as CSSProperties;
  return (
    <div className="hit-feedback" key={nonce} style={style} aria-hidden="true">
      <div className="hit-flash-layer" />
      <div className="hit-ring" />
    </div>
  );
}
