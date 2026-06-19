import { Circle, Film, ImageDown, Square } from 'lucide-react';

interface CaptureBarProps {
  visible: boolean;
  onCapture: () => void;
  canRecord: boolean;
  isRecording: boolean;
  elapsedMs: number;
  onToggleRecord: () => void;
  onOpenWorks: () => void;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Bottom thumb-zone toolbar (v0.4) for the capture loop: screenshot, record, works.
 * Lives in reach on mobile rather than crammed into the top header.
 */
export function CaptureBar({
  visible,
  onCapture,
  canRecord,
  isRecording,
  elapsedMs,
  onToggleRecord,
  onOpenWorks,
}: CaptureBarProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="capture-bar" role="toolbar" aria-label="拍摄工具">
      <button className="capture-btn" type="button" onClick={onCapture} aria-label="截图">
        <ImageDown size={20} />
        <span>截图</span>
      </button>

      {canRecord ? (
        <button
          className={`capture-btn capture-record${isRecording ? ' is-recording' : ''}`}
          type="button"
          onClick={onToggleRecord}
          aria-label={isRecording ? '停止录制' : '开始录制'}
          aria-pressed={isRecording}
        >
          {isRecording ? <Square size={18} /> : <Circle size={20} />}
          <span>{isRecording ? formatTime(elapsedMs) : '录制'}</span>
        </button>
      ) : null}

      <button className="capture-btn" type="button" onClick={onOpenWorks} aria-label="我的作品">
        <Film size={20} />
        <span>作品</span>
      </button>
    </div>
  );
}
