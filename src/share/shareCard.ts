import QRCode from 'qrcode';

// v1.1 — social share card: turns a screenshot into a branded, vertical card with a
// QR code back to the site, so a shared image carries its own growth loop.
const SITE_URL = 'https://aura-seal.vercel.app';
const PITCH = '对着摄像头结印,迸发你的能量特效';

export interface ShareCard {
  dataUrl: string;
  blob: Blob;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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

export async function makeShareCard(sourceDataUrl: string): Promise<ShareCard | null> {
  const source = await loadImage(sourceDataUrl);
  const W = 1080;
  const H = 1350;
  const pad = 56;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  // Background with a soft accent glow at the top.
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, 220, 40, W / 2, 220, 700);
  grad.addColorStop(0, 'rgba(102, 234, 255, 0.18)');
  grad.addColorStop(1, 'rgba(5, 7, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Screenshot, cover-cropped into a rounded frame.
  const frameW = W - pad * 2;
  const frameH = Math.round(frameW * 0.62);
  ctx.save();
  roundRect(ctx, pad, pad, frameW, frameH, 28);
  ctx.clip();
  const scale = Math.max(frameW / source.width, frameH / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.drawImage(source, pad + (frameW - dw) / 2, pad + (frameH - dh) / 2, dw, dh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(133, 238, 255, 0.38)';
  ctx.lineWidth = 2;
  roundRect(ctx, pad, pad, frameW, frameH, 28);
  ctx.stroke();

  // Footer: brand + pitch on the left, QR on the right.
  const footerY = pad + frameH + 64;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f6fbff';
  ctx.font = '700 64px "Inter Variable", system-ui, "PingFang SC", sans-serif';
  ctx.fillText('AuraSeal', pad, footerY);
  ctx.fillStyle = '#66eaff';
  ctx.font = '700 40px system-ui, "PingFang SC", sans-serif';
  ctx.fillText('灵印引擎', pad, footerY + 78);
  ctx.fillStyle = '#b6c5cc';
  ctx.font = '400 30px system-ui, "PingFang SC", sans-serif';
  ctx.fillText(PITCH, pad, footerY + 138);
  ctx.fillStyle = '#8a98a0';
  ctx.font = '500 26px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(SITE_URL.replace('https://', ''), pad, footerY + 186);

  const qrSize = 200;
  const qrX = W - pad - qrSize;
  const qrY = footerY + 8;
  const qrUrl = await QRCode.toDataURL(SITE_URL, {
    margin: 1,
    width: qrSize,
    color: { dark: '#05070a', light: '#ffffff' },
  });
  const qrImg = await loadImage(qrUrl);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18);
  ctx.fill();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) {
    return null;
  }
  return { dataUrl: canvas.toDataURL('image/png'), blob };
}
