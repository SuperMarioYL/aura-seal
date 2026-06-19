import { Gauge, Radio, TimerReset } from 'lucide-react';
import type { AppMode, GestureEvent } from '../vision/types';
import type { CameraStatus } from '../app/useCamera';

interface StatusBarProps {
  mode: AppMode;
  cameraStatus: CameraStatus;
  visionStatus: string;
  latestGesture: GestureEvent | null;
  fps: number;
  visionError: string | null;
}

export function StatusBar({
  mode,
  cameraStatus,
  visionStatus,
  latestGesture,
  fps,
  visionError,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div>
        <Radio size={15} />
        <span>模式：{mode === 'auto' ? '自动识别' : '手动测试'}</span>
      </div>
      <div>
        <Gauge size={15} />
        <span>摄像头：{cameraText(cameraStatus)}</span>
      </div>
      <div>
        <TimerReset size={15} />
        <span>冷却：{latestGesture ? `${latestGesture.label} 已触发` : '待命'}</span>
      </div>
      <div className={visionStatus === 'error' ? 'status-danger' : ''}>
        <span>
          {visionError
            ? `模型：${visionError}`
            : `模型：${visionText(visionStatus)} / ${fps || '--'} FPS`}
        </span>
      </div>
    </footer>
  );
}

function cameraText(status: CameraStatus): string {
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
