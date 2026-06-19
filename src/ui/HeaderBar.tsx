import { Activity, Camera, Clapperboard, Cpu, Sparkles } from 'lucide-react';
import type { AppMode } from '../vision/types';
import type { CameraStatus } from '../app/useCamera';

interface HeaderBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  cameraStatus: CameraStatus;
  visionStatus: string;
  animationPanelOpen: boolean;
  actionPanelOpen: boolean;
  onToggleAnimationPanel: () => void;
  onToggleActionPanel: () => void;
}

export function HeaderBar({
  mode,
  onModeChange,
  cameraStatus,
  visionStatus,
  animationPanelOpen,
  actionPanelOpen,
  onToggleAnimationPanel,
  onToggleActionPanel,
}: HeaderBarProps) {
  return (
    <header className="header-bar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={18} />
        </div>
        <div>
          <strong>AuraSeal</strong>
          <span>灵印引擎</span>
        </div>
      </div>

      <div className="status-chips" aria-label="系统状态">
        <span className={`status-chip ${cameraStatus === 'ready' ? 'ok' : ''}`}>
          <Camera size={15} />
          摄像头 {statusText(cameraStatus)}
        </span>
        <span className={`status-chip ${visionStatus === 'running' ? 'ok' : ''}`}>
          <Cpu size={15} />
          模型 {visionText(visionStatus)}
        </span>
      </div>

      <div className="header-actions">
        <button
          className={`floating-toggle ${animationPanelOpen ? 'active' : ''}`}
          type="button"
          onClick={onToggleAnimationPanel}
          aria-label={animationPanelOpen ? '隐藏动画效果面板' : '显示动画效果面板'}
        >
          <Clapperboard size={17} />
          动画
        </button>
        <div className="mode-switch" role="group" aria-label="识别模式">
          <button
            className={mode === 'auto' ? 'active' : ''}
            type="button"
            aria-pressed={mode === 'auto'}
            onClick={() => onModeChange('auto')}
          >
            自动识别
          </button>
          <button
            className={mode === 'manual' ? 'active' : ''}
            type="button"
            aria-pressed={mode === 'manual'}
            onClick={() => onModeChange('manual')}
          >
            手动测试
          </button>
        </div>
        <button
          className={`floating-toggle ${actionPanelOpen ? 'active' : ''}`}
          type="button"
          onClick={onToggleActionPanel}
          aria-label={actionPanelOpen ? '隐藏动作教学面板' : '显示动作教学面板'}
        >
          <Activity size={17} />
          动作
        </button>
      </div>
    </header>
  );
}

function statusText(status: CameraStatus): string {
  const map: Record<CameraStatus, string> = {
    idle: '未启动',
    requesting: '请求中',
    ready: '运行中',
    denied: '被拒绝',
    error: '异常',
  };
  return map[status];
}

function visionText(status: string): string {
  const map: Record<string, string> = {
    idle: '待机',
    loading: '加载中',
    running: '运行中',
    error: '异常',
  };
  return map[status] ?? status;
}
