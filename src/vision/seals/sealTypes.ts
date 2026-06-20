// Overhaul P4 — the seal ("印") set. Six single-hand seals chosen so their finger
// patterns are pairwise distinct by ≥2 fingers, using index/middle/ring/pinky only
// (the thumb is the least reliable to detect, so it's excluded from classification).
export type Seal = 'zi' | 'wu' | 'mao' | 'you' | 'yin' | 'chen';

export const SEALS: Seal[] = ['zi', 'wu', 'mao', 'you', 'yin', 'chen'];

export const SEAL_LABELS: Record<Seal, string> = {
  zi: '子',
  wu: '午',
  mao: '卯',
  you: '酉',
  yin: '寅',
  chen: '辰',
};

// 4-bit finger mask: bit0=index, bit1=middle, bit2=ring, bit3=pinky.
export const SEAL_FINGER_MASK: Record<Seal, number> = {
  zi: 0b0000, // 握拳
  wu: 0b1111, // 张开五指
  mao: 0b0011, // 食指+中指(剪刀)
  you: 0b1100, // 无名指+小指
  yin: 0b1001, // 食指+小指
  chen: 0b0110, // 中指+无名指
};

export const SEAL_HINT: Record<Seal, string> = {
  zi: '握拳',
  wu: '张开五指',
  mao: '食指中指(剪刀手)',
  you: '无名指+小指',
  yin: '食指+小指',
  chen: '中指+无名指',
};
