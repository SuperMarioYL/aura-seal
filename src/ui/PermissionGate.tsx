import { Camera, CameraOff, LoaderCircle, Play, ShieldCheck } from 'lucide-react';
import type { CameraStatus } from '../app/useCamera';

interface PermissionGateProps {
  status: CameraStatus;
  error: string | null;
  onStart: () => void;
}

export function PermissionGate({ status, error, onStart }: PermissionGateProps) {
  if (status === 'ready') {
    return null;
  }

  const requesting = status === 'requesting';
  const denied = status === 'denied' || status === 'error';

  return (
    <div className="permission-gate">
      <div className="permission-mark" aria-hidden="true">
        {requesting ? <LoaderCircle /> : denied ? <CameraOff /> : <Camera />}
      </div>
      <h1>AuraSeal</h1>
      <p className="cn-title">灵印引擎</p>
      <p className="permission-copy">
        授权摄像头后，系统会在本地识别动作并把原创能量特效叠加到实时画面上。
      </p>
      <span className="permission-privacy">
        <ShieldCheck size={14} />
        本地推理 · 视频不上传
      </span>
      {error ? <p className="permission-error">{error}</p> : null}
      <button className="primary-action" type="button" onClick={onStart} disabled={requesting}>
        {requesting ? <LoaderCircle className="spin" /> : <Play />}
        {requesting ? '正在请求摄像头' : '启动摄像头'}
      </button>
    </div>
  );
}
