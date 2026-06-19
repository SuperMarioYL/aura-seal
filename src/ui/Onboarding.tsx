import { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import type { GestureEvent, VisionSnapshot } from '../vision/types';
import { GestureGlyph } from './GestureGlyph';
import { markOnboarded } from './onboardingState';

interface OnboardingProps {
  snapshot: VisionSnapshot;
  latestGesture: GestureEvent | null;
  onClose: () => void;
}

/**
 * v0.8 — first-run guide. Walks a new user from "get in frame" to "land your first
 * cast", using the data the vision loop already produces so each step confirms itself.
 * Replaces the old "授权后空房间" with a one-minute path to a successful trigger.
 */
export function Onboarding({ snapshot, latestGesture, onClose }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const present = snapshot.detectedHands > 0 || snapshot.hasPose;

  // Step 0 → 1 once the user is detected in frame.
  useEffect(() => {
    if (step === 0 && present) {
      const t = setTimeout(() => setStep(1), 600);
      return () => clearTimeout(t);
    }
  }, [step, present]);

  // Step 1 → 2 once any gesture lands.
  useEffect(() => {
    if (step === 1 && latestGesture) {
      setStep(2);
    }
  }, [step, latestGesture]);

  const finish = () => {
    markOnboarded();
    onClose();
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="新手引导">
      <div className="onboarding-card">
        <button className="screenshot-close" type="button" onClick={finish} aria-label="跳过引导">
          <X size={18} />
        </button>

        <div className="onboarding-steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`onboarding-dot${i <= step ? ' done' : ''}`} />
          ))}
        </div>

        {step === 0 ? (
          <>
            <div className="onboarding-icon waiting">
              <GestureGlyph kind="both_hands_raised" size={26} />
            </div>
            <h2>把上半身放进画面</h2>
            <p>站远一点、光线充足,让头和手都进入镜头。检测到你之后会自动进入下一步。</p>
            <span className={`onboarding-state${present ? ' ok' : ''}`}>
              {present ? '已检测到你 ✓' : '正在寻找你…'}
            </span>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="onboarding-icon">
              <GestureGlyph kind="raised_hand" size={26} />
            </div>
            <h2>跟我做:举手</h2>
            <p>把一只手举过头顶,手腕高于脸部,保持半秒。命中后会迸发能量光柱。</p>
            <span className="onboarding-state">
              手部 {snapshot.detectedHands} · 姿态 {snapshot.hasPose ? '已锁定' : '搜索中'}
            </span>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="onboarding-icon ok">
              <Check size={26} />
            </div>
            <h2>成功!{latestGesture ? `「${latestGesture.label}」已触发` : ''}</h2>
            <p>你已经学会出招了。试试动作教学里的更多手势,或一键截图/录制把成片分享出去。</p>
            <button className="primary-action" type="button" onClick={finish}>
              开始自由出招
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
