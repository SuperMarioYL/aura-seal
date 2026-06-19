import type { EffectKind, EffectPreset } from './types';
import type { GestureKind } from '../vision/types';

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'seal',
    gesture: 'palms_joined',
    name: '灵印阵',
    description: '在双手之间展开定位印环。',
    color: '#ff4e61',
    accent: '#7ff7ff',
    intensity: 0.86,
    durationMs: 1500,
  },
  {
    id: 'shockwave',
    gesture: 'push_palm',
    name: '冲击波',
    description: '从掌心沿推掌方向扩散。',
    color: '#71f7ff',
    accent: '#ffffff',
    intensity: 0.92,
    durationMs: 1250,
  },
  {
    id: 'energy_orb',
    gesture: 'charge_stance',
    name: '能量球',
    description: '在双手之间凝聚能量核。',
    color: '#45ddff',
    accent: '#ff5a69',
    intensity: 1,
    durationMs: 1700,
  },
  {
    id: 'speed_lines',
    gesture: 'punch',
    name: '拳风',
    description: '沿手臂方向切出短促拳风。',
    color: '#f8fdff',
    accent: '#8af7ff',
    intensity: 0.74,
    durationMs: 900,
  },
  {
    id: 'light_column',
    gesture: 'raised_hand',
    name: '光柱',
    description: '在举起的手附近落下光束。',
    color: '#bafcff',
    accent: '#ff5a69',
    intensity: 0.82,
    durationMs: 1350,
  },
  {
    id: 'aura_burst',
    gesture: 'crouch',
    name: '爆气',
    description: '从身体下方扩散地面气浪。',
    color: '#63ecff',
    accent: '#ff5a69',
    intensity: 0.96,
    durationMs: 1200,
  },
  {
    id: 'barrier',
    gesture: 'cross_guard',
    name: '护盾展开',
    description: '交叉手臂前方展开防御场。',
    color: '#76f3ff',
    accent: '#ff5870',
    intensity: 0.9,
    durationMs: 1450,
  },
  {
    id: 'skyfall',
    gesture: 'both_hands_raised',
    name: '天幕落光',
    description: '双手上举后落下多束能量光。',
    color: '#d7fbff',
    accent: '#66e9ff',
    intensity: 0.95,
    durationMs: 1500,
  },
  {
    id: 'guard_flare',
    gesture: 'guard_stance',
    name: '斗气护身',
    description: '拳架周围形成短促气焰。',
    color: '#8df7ff',
    accent: '#ff5a69',
    intensity: 0.78,
    durationMs: 1200,
  },
  {
    id: 'beam',
    gesture: 'finger_point',
    name: '指令射线',
    description: '从指尖射出集束光线。',
    color: '#f3fdff',
    accent: '#67efff',
    intensity: 0.86,
    durationMs: 900,
  },
  {
    id: 'slash',
    gesture: 'side_slash',
    name: '横扫斩击',
    description: '跟随手臂横扫切出弧光。',
    color: '#fff9f3',
    accent: '#6cf1ff',
    intensity: 0.92,
    durationMs: 920,
  },
];

export const JUMP_PRESET: EffectPreset = {
  id: 'aura_burst',
  gesture: 'jump',
  name: '空跃爆气',
  description: '跳跃瞬间在落点附近扩散气浪。',
  color: '#b7f9ff',
  accent: '#ffffff',
  intensity: 0.8,
  durationMs: 950,
};

export function presetForGesture(gesture: GestureKind): EffectPreset {
  if (gesture === 'jump') {
    return JUMP_PRESET;
  }

  return EFFECT_PRESETS.find((preset) => preset.gesture === gesture) ?? EFFECT_PRESETS[0];
}

export function presetById(id: EffectKind): EffectPreset {
  return EFFECT_PRESETS.find((preset) => preset.id === id) ?? EFFECT_PRESETS[0];
}
