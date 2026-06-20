import { useState } from 'react';
import { Check, Copy, Download, QrCode, RotateCcw, Share2, X } from 'lucide-react';
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

function filename(card: boolean) {
  // No Date.now() dependency on the hot path; a coarse stamp is fine for a filename.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `auraseal${card ? '-card' : ''}-${stamp}.png`;
}

export function ScreenshotPreview({ result, onClose, onRetake }: ScreenshotPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [building, setBuilding] = useState(false);

  if (!result) {
    return null;
  }

  const active = card ?? result;
  const isCard = card !== null;

  const handleCopy = async () => {
    const ok = await copyBlobToClipboard(active.blob);
    setCopied(ok);
    if (ok) {
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const handleMakeCard = async () => {
    setBuilding(true);
    try {
      // Lazy-load so qrcode stays out of the first-paint bundle.
      const { makeShareCard } = await import('../share/shareCard');
      const made = await makeShareCard(result.dataUrl);
      if (made) {
        setCard(made);
      }
    } finally {
      setBuilding(false);
    }
  };

  const close = () => {
    setCard(null);
    onClose();
  };

  return (
    <div className="screenshot-overlay" role="dialog" aria-modal="true" aria-label="截图预览">
      <div className="screenshot-card">
        <button className="screenshot-close" type="button" onClick={close} aria-label="关闭预览">
          <X size={18} />
        </button>
        <img src={active.dataUrl} alt={isCard ? 'AuraSeal 分享卡' : 'AuraSeal 截图预览'} />
        <div className="screenshot-actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => downloadBlob(active.blob, filename(isCard))}
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
              shareBlob(active.blob, filename(isCard), '我用 AuraSeal 灵印引擎生成的能量特效')
            }
          >
            <Share2 size={16} />
            分享
          </button>
          {isCard ? (
            <button className="ghost-action" type="button" onClick={() => setCard(null)}>
              <RotateCcw size={16} />
              返回
            </button>
          ) : (
            <button
              className="ghost-action"
              type="button"
              onClick={handleMakeCard}
              disabled={building}
            >
              <QrCode size={16} />
              {building ? '生成中…' : '分享卡'}
            </button>
          )}
          <button className="ghost-action" type="button" onClick={onRetake}>
            <RotateCcw size={16} />
            重拍
          </button>
        </div>
      </div>
    </div>
  );
}
