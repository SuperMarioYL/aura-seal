const SPOKES = [0, 60, 120, 180, 240, 300];

/**
 * v1.0 brand mark — a "灵印" sigil (concentric rings + rune spokes + core) that echoes
 * the seal effect, replacing the generic Sparkles icon. Uses currentColor so it inherits
 * the surrounding accent.
 */
export function SealMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <circle cx="12" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      {SPOKES.map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={12 + Math.cos(a) * 5.6}
            y1={12 + Math.sin(a) * 5.6}
            x2={12 + Math.cos(a) * 8.6}
            y2={12 + Math.sin(a) * 8.6}
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.6"
          />
        );
      })}
    </svg>
  );
}
