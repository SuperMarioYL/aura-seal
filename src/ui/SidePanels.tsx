import { BookOpen, Hand, RadioTower, Zap } from 'lucide-react';
import type { EffectPreset } from '../effects/types';
import type { GestureEvent, VisionSnapshot } from '../vision/types';
import {
  GESTURE_GUIDES,
  type GestureGuide,
  manualTriggerForGesture,
} from '../vision/gestureGuides';
import { GestureGlyph } from './GestureGlyph';

interface SidePanelsProps {
  snapshot: VisionSnapshot;
  recentGestures: GestureEvent[];
  onManualTrigger: (preset: EffectPreset) => void;
  manualEnabled: boolean;
  activeGesture: GestureEvent | null;
}

export function LeftPanel({ snapshot, recentGestures, activeGesture }: SidePanelsProps) {
  return (
    <aside className="panel left-panel" aria-label="动画效果状态">
      <div className="panel-title">
        <ClapperTitle />
        动画效果
      </div>
      <div className="metric-grid">
        <Metric label="FPS" value={snapshot.fps || '--'} />
        <Metric label="手部" value={snapshot.detectedHands} />
        <Metric label="姿态" value={snapshot.hasPose ? '已锁定' : '搜索中'} />
      </div>
      <div className="active-readout">
        <span>当前命中</span>
        <strong>{activeGesture?.label ?? '等待动作'}</strong>
        <small>
          {activeGesture
            ? `${Math.round(activeGesture.confidence * 100)}% 置信度`
            : '完成结印或姿态后触发'}
        </small>
      </div>
      <div className="timeline">
        {recentGestures.length === 0 ? (
          <div className="empty-line">暂无触发记录</div>
        ) : (
          recentGestures.map((gesture) => (
            <div className="timeline-row" key={gesture.id}>
              <Hand size={14} />
              <span>{gesture.label}</span>
              <em>{Math.round(gesture.confidence * 100)}%</em>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function ClapperTitle() {
  return <Zap size={16} />;
}

export function RightPanel({ onManualTrigger, manualEnabled, activeGesture }: SidePanelsProps) {
  return (
    <aside className="panel right-panel" aria-label="动作教学与特效测试">
      <div className="panel-title">
        <BookOpen size={16} />
        动作教学
      </div>
      <div className="preset-list">
        {GESTURE_GUIDES.map((guide) => (
          <GestureGuideCard
            guide={guide}
            key={guide.kind}
            manualEnabled={manualEnabled}
            onManualTrigger={onManualTrigger}
            active={activeGesture?.kind === guide.kind}
          />
        ))}
      </div>
      <div className="signal-note">
        <RadioTower size={15} />
        自动模式使用本地浏览器模型，不上传视频。
      </div>
    </aside>
  );
}

function GestureGuideCard({
  guide,
  manualEnabled,
  onManualTrigger,
  active,
}: {
  guide: GestureGuide;
  manualEnabled: boolean;
  onManualTrigger: (preset: EffectPreset) => void;
  active: boolean;
}) {
  const trigger = manualTriggerForGesture(guide.kind);

  return (
    <article className={`gesture-card${active ? ' is-active' : ''}`}>
      <GestureGlyph kind={guide.kind} />
      <div>
        <strong>{guide.title}</strong>
        <p>{guide.shortInstruction}</p>
        <small>{guide.recognitionTip}</small>
      </div>
      <button
        className="ghost-action"
        type="button"
        onClick={() => onManualTrigger(trigger.preset)}
        disabled={!manualEnabled}
      >
        <Zap size={14} />
        试效果
      </button>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
