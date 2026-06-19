import { useState } from 'react';
import { Check, Copy, Download, RotateCcw, Share2, X } from 'lucide-react';
import {
  copyBlobToClipboard,
  downloadBlob,
  shareBlob,
  type CaptureResult,
} from '../recording/capture';

interface ScreenshotPreviewProps {
  result: CaptureResult | null;
  onClose: () => void;
  onRetake: () => void;
}

function filename() {
  // No Date.now() dependency on the hot path; a coarse stamp is fine for a filename.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `auraseal-${stamp}.png`;
}

export function ScreenshotPreview({ result, onClose, onRetake }: ScreenshotPreviewProps) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return null;
  }

  const handleCopy = async () => {
    const ok = await copyBlobToClipboard(result.blob);
    setCopied(ok);
    if (ok) {
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="screenshot-overlay" role="dialog" aria-modal="true" aria-label="截图预览">
      <div className="screenshot-card">
        <button className="screenshot-close" type="button" onClick={onClose} aria-label="关闭预览">
          <X size={18} />
        </button>
        <img src={result.dataUrl} alt="AuraSeal 截图预览" />
        <div className="screenshot-actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => downloadBlob(result.blob, filename())}
          >
            <Download size={16} />
            下载
          </button>
          <button className="ghost-action" type="button" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            className="ghost-action"
            type="button"
            onClick={() =>
              shareBlob(result.blob, filename(), '我用 AuraSeal 灵印引擎生成的能量特效')
            }
          >
            <Share2 size={16} />
            分享
          </button>
          <button className="ghost-action" type="button" onClick={onRetake}>
            <RotateCcw size={16} />
            重拍
          </button>
        </div>
      </div>
    </div>
  );
}
