import type { EffectPreset } from '../effects/types';
import { presetForGesture } from '../effects/presets';
import type { GestureKind } from './types';

export interface GestureGuide {
  kind: GestureKind;
  title: string;
  shortInstruction: string;
  recognitionTip: string;
  effectBehavior: string;
  defaultAnchor: { x: number; y: number };
  defaultDirection: { x: number; y: number };
}

export const GESTURE_GUIDES: GestureGuide[] = [
  {
    kind: 'palms_joined',
    title: '双手合十',
    shortInstruction: '双手在胸前合拢，掌根和指尖靠近。',
    recognitionTip: '让两只手都进入画面，停留半秒。',
    effectBehavior: '灵印阵会在两掌之间展开。',
    defaultAnchor: { x: 0.5, y: 0.48 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'push_palm',
    title: '推掌',
    shortInstruction: '一只手打开，掌心朝镜头向前推。',
    recognitionTip: '手掌放在胸口到肩膀高度，手指尽量张开。',
    effectBehavior: '冲击波从掌心向前扩散。',
    defaultAnchor: { x: 0.58, y: 0.42 },
    defaultDirection: { x: 1, y: -0.05 },
  },
  {
    kind: 'charge_stance',
    title: '蓄力姿势',
    shortInstruction: '双手靠近腰前或腹前，像托住一个球。',
    recognitionTip: '两只手腕靠近身体中线，不要完全遮挡。',
    effectBehavior: '能量球会在双手之间聚集。',
    defaultAnchor: { x: 0.5, y: 0.62 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'punch',
    title: '挥拳',
    shortInstruction: '单臂向前伸直，拳头指向镜头或画面侧前方。',
    recognitionTip: '肩、肘、腕尽量成一直线。',
    effectBehavior: '拳风沿手臂方向切出。',
    defaultAnchor: { x: 0.62, y: 0.44 },
    defaultDirection: { x: 1, y: -0.1 },
  },
  {
    kind: 'raised_hand',
    title: '举手',
    shortInstruction: '一只手举过头顶，手腕明显高于脸部。',
    recognitionTip: '站远一点，让头和手同时入镜。',
    effectBehavior: '光柱会落在举起的手附近。',
    defaultAnchor: { x: 0.5, y: 0.2 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'crouch',
    title: '蹲下',
    shortInstruction: '身体下蹲，让髋部明显下降。',
    recognitionTip: '保持上半身和膝盖在画面里。',
    effectBehavior: '地面气浪从身体下方扩散。',
    defaultAnchor: { x: 0.5, y: 0.78 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'jump',
    title: '跳跃',
    shortInstruction: '从站立向上跳起，身体短时间离开原位置。',
    recognitionTip: '先站稳再跳，模型会比较前后帧高度。',
    effectBehavior: '落点附近产生轻量爆气。',
    defaultAnchor: { x: 0.5, y: 0.74 },
    defaultDirection: { x: 0, y: 1 },
  },
  {
    kind: 'cross_guard',
    title: '交叉防御',
    shortInstruction: '两只前臂在胸前交叉，挡在身体前方。',
    recognitionTip: '手腕靠近胸口，左右手形成明显交叉。',
    effectBehavior: '护盾会在交叉位置前方展开。',
    defaultAnchor: { x: 0.5, y: 0.42 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'both_hands_raised',
    title: '双手举起',
    shortInstruction: '两只手同时举过头顶。',
    recognitionTip: '让两只手腕都高于脸部。',
    effectBehavior: '多束能量光从上方落下。',
    defaultAnchor: { x: 0.5, y: 0.16 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'guard_stance',
    title: '格斗架势',
    shortInstruction: '双拳靠近脸侧，手肘弯曲。',
    recognitionTip: '像准备格挡或出拳，拳头不要放太低。',
    effectBehavior: '斗气会围绕上半身闪动。',
    defaultAnchor: { x: 0.5, y: 0.36 },
    defaultDirection: { x: 0, y: -1 },
  },
  {
    kind: 'finger_point',
    title: '指向',
    shortInstruction: '伸出食指指向镜头或画面前方。',
    recognitionTip: '食指伸直，其他手指尽量收起。',
    effectBehavior: '射线从指尖方向发出。',
    defaultAnchor: { x: 0.58, y: 0.38 },
    defaultDirection: { x: 1, y: -0.02 },
  },
  {
    kind: 'side_slash',
    title: '横扫',
    shortInstruction: '单臂从身体一侧向外横扫。',
    recognitionTip: '手腕和肩膀保持接近同一高度。',
    effectBehavior: '斩击弧线沿手臂方向扫出。',
    defaultAnchor: { x: 0.66, y: 0.42 },
    defaultDirection: { x: 1, y: 0 },
  },
];

const MANUAL_PREVIEW_POSES: Partial<
  Record<
    GestureKind,
    {
      anchor: { x: number; y: number };
      direction: { x: number; y: number };
    }
  >
> = {
  push_palm: {
    anchor: { x: 0.34, y: 0.43 },
    direction: { x: 1, y: -0.04 },
  },
  punch: {
    anchor: { x: 0.35, y: 0.45 },
    direction: { x: 1, y: -0.12 },
  },
  finger_point: {
    anchor: { x: 0.34, y: 0.38 },
    direction: { x: 1, y: -0.03 },
  },
  side_slash: {
    anchor: { x: 0.38, y: 0.46 },
    direction: { x: 1, y: 0 },
  },
  raised_hand: {
    anchor: { x: 0.42, y: 0.22 },
    direction: { x: 0, y: -1 },
  },
  both_hands_raised: {
    anchor: { x: 0.42, y: 0.16 },
    direction: { x: 0, y: -1 },
  },
};

export function guideForGesture(kind: GestureKind): GestureGuide {
  return GESTURE_GUIDES.find((guide) => guide.kind === kind) ?? GESTURE_GUIDES[0];
}

export function manualTriggerForGesture(kind: GestureKind): {
  preset: EffectPreset;
  anchor: { x: number; y: number };
  direction: { x: number; y: number };
} {
  const guide = guideForGesture(kind);
  const preview = MANUAL_PREVIEW_POSES[kind];
  return {
    preset: presetForGesture(kind),
    anchor: preview?.anchor ?? guide.defaultAnchor,
    direction: preview?.direction ?? guide.defaultDirection,
  };
}
