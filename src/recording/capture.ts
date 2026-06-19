// v0.3/v0.4 — frame compositing shared by one-click screenshot and clip recording.
// Reproduces exactly what the user sees on screen: the (mirrored) camera frame +
// the WebGL effects overlay + an AuraSeal watermark.

export interface CaptureResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

const WATERMARK = 'AuraSeal · 灵印引擎';

export function compositeSize(
  video: HTMLVideoElement,
  effectCanvas: HTMLCanvasElement | null,
): { width: number; height: number } {
  if (video.videoWidth && video.videoHeight) {
    return { width: video.videoWidth, height: video.videoHeight };
  }
  if (effectCanvas && effectCanvas.width && effectCanvas.height) {
    return { width: effectCanvas.width, height: effectCanvas.height };
  }
  return { width: 1280, height: 720 };
}

/**
 * Paint one composited frame into `ctx`. Called once for a screenshot, and per-frame
 * by the recorder's draw loop.
 */
export function paintComposite(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  effectCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
) {
  // Mirror the camera feed to match the on-screen `transform: scaleX(-1)`.
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  // Effects overlay is drawn un-mirrored, exactly as it sits over the feed on screen.
  if (effectCanvas && effectCanvas.width > 0 && effectCanvas.height > 0) {
    try {
      ctx.drawImage(effectCanvas, 0, 0, width, height);
    } catch (err) {
      console.warn('[AuraSeal] effect layer not capturable', err);
    }
  }

  drawWatermark(ctx, width, height);
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pad = Math.round(width * 0.018);
  const fontSize = Math.max(14, Math.round(width * 0.022));
  ctx.font = `600 ${fontSize}px "Inter Variable", system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const metrics = ctx.measureText(WATERMARK);
  const boxW = metrics.width + pad * 1.6;
  const boxH = fontSize + pad;
  const x = width - pad;
  const y = height - pad;

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#05070a';
  roundRect(ctx, x - boxW, y - boxH, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#66eaff';
  ctx.shadowColor = 'rgba(102, 234, 255, 0.6)';
  ctx.shadowBlur = fontSize * 0.6;
  ctx.fillText(WATERMARK, x - pad * 0.5, y - pad * 0.4);
  ctx.shadowBlur = 0;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function captureComposite(
  video: HTMLVideoElement,
  effectCanvas: HTMLCanvasElement | null,
): Promise<CaptureResult | null> {
  if (!video.videoWidth || video.readyState < 2) {
    return null;
  }

  const { width, height } = compositeSize(video, effectCanvas);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  paintComposite(ctx, video, effectCanvas, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) {
    return null;
  }
  return { dataUrl: canvas.toDataURL('image/png'), blob, width, height };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem })
      .ClipboardItem;
    if (!navigator.clipboard || !ClipboardItemCtor) {
      return false;
    }
    await navigator.clipboard.write([new ClipboardItemCtor({ [blob.type]: blob })]);
    return true;
  } catch (err) {
    console.warn('[AuraSeal] clipboard copy failed', err);
    return false;
  }
}

export async function shareBlob(blob: Blob, filename: string, text: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (!nav.share) {
      return false;
    }
    const file = new File([blob], filename, { type: blob.type });
    const data: ShareData = { files: [file], title: 'AuraSeal 灵印引擎', text };
    if (nav.canShare && !nav.canShare(data)) {
      // Fall back to text/title-only share if files aren't shareable.
      await nav.share({ title: 'AuraSeal 灵印引擎', text });
      return true;
    }
    await nav.share(data);
    return true;
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      return true;
    }
    console.warn('[AuraSeal] share failed', err);
    return false;
  }
}
