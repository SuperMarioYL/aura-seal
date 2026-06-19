import type { EffectPalette } from '../effects/types';

// v0.9 — skins re-tint the effect palettes via a hue rotation, giving每个用户'我的风格'
// without authoring new palettes. Pure color math so it's unit-testable.
export interface Skin {
  id: string;
  name: string;
  hue: number; // degrees
}

export const SKINS: Skin[] = [
  { id: 'origin', name: '本源', hue: 0 },
  { id: 'crimson', name: '赤焰', hue: -150 },
  { id: 'violet', name: '紫电', hue: 70 },
  { id: 'verdant', name: '青木', hue: 135 },
];

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return [255, 255, 255];
  }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) {
    h = (gg - bb) / d + (gg < bb ? 6 : 0);
  } else if (max === gg) {
    h = (bb - rr) / d + 2;
  } else {
    h = (rr - gg) / d + 4;
  }
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, hn + 1 / 3) * 255,
    hue2rgb(p, q, hn) * 255,
    hue2rgb(p, q, hn - 1 / 3) * 255,
  ];
}

export function rotateHue(hex: string, deg: number): string {
  if (deg === 0) {
    return hex;
  }
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h + deg, s, l);
  return rgbToHex(nr, ng, nb);
}

export function applySkin(palette: EffectPalette, skin: Skin): EffectPalette {
  if (!skin || skin.hue === 0) {
    return palette;
  }
  return {
    core: rotateHue(palette.core, skin.hue),
    mid: rotateHue(palette.mid, skin.hue),
    rim: rotateHue(palette.rim, skin.hue),
    spark: rotateHue(palette.spark, skin.hue),
    glow: rotateHue(palette.glow, skin.hue),
  };
}

const LS_SKIN = 'auraseal.skin';

export function loadSkin(): Skin {
  try {
    const id = localStorage.getItem(LS_SKIN);
    return SKINS.find((s) => s.id === id) ?? SKINS[0];
  } catch {
    return SKINS[0];
  }
}

export function saveSkin(skin: Skin) {
  try {
    localStorage.setItem(LS_SKIN, skin.id);
  } catch {
    // ignore
  }
}
