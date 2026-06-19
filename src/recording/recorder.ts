// v0.4 — clip recording. A 2D composite canvas is painted every frame (mirrored
// camera + WebGL effects + watermark), captured as a MediaStream and encoded by
// MediaRecorder into a webm. This is the core of the "录屏 → 导出 → 分享" loop.
import { compositeSize, paintComposite } from './capture';

export interface RecordedClip {
  blob: Blob;
  thumbnail: string;
  durationMs: number;
  width: number;
  height: number;
  mimeType: string;
}

export const MAX_RECORDING_MS = 15000;
const FPS = 30;
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return null;
  }
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickMimeType() !== null
  );
}

export class ClipRecorder {
  private composite = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stopTimer = 0;
  private mime: string;
  private width = 0;
  private height = 0;

  constructor(
    private video: HTMLVideoElement,
    private getEffectCanvas: () => HTMLCanvasElement | null,
    private getAudioStream?: () => MediaStream | null,
  ) {
    this.ctx = this.composite.getContext('2d');
    this.mime = pickMimeType() ?? 'video/webm';
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  get elapsedMs(): number {
    return this.recorder ? performance.now() - this.startedAt : 0;
  }

  start(onAutoStop?: () => void): boolean {
    if (this.recorder || !this.ctx || !this.video.videoWidth) {
      return false;
    }

    const { width, height } = compositeSize(this.video, this.getEffectCanvas());
    this.width = width;
    this.height = height;
    this.composite.width = width;
    this.composite.height = height;

    let recorder: MediaRecorder;
    try {
      const stream = this.composite.captureStream(FPS);
      // Mux the sfx/BGM audio bus into the recording so exported clips have sound.
      const audio = this.getAudioStream?.();
      audio?.getAudioTracks().forEach((track) => stream.addTrack(track));
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: this.mime,
          videoBitsPerSecond: 6_000_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }
    } catch (err) {
      console.warn('[AuraSeal] recording start failed', err);
      return false;
    }

    this.recorder = recorder;
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    recorder.start(200);
    this.startedAt = performance.now();
    this.draw();
    this.stopTimer = window.setTimeout(() => onAutoStop?.(), MAX_RECORDING_MS);
    return true;
  }

  private draw = () => {
    if (!this.ctx) {
      return;
    }
    paintComposite(this.ctx, this.video, this.getEffectCanvas(), this.width, this.height);
    this.raf = requestAnimationFrame(this.draw);
  };

  async stop(): Promise<RecordedClip | null> {
    const recorder = this.recorder;
    if (!recorder) {
      return null;
    }
    window.clearTimeout(this.stopTimer);
    cancelAnimationFrame(this.raf);
    const durationMs = performance.now() - this.startedAt;
    const thumbnail = this.composite.toDataURL('image/jpeg', 0.7);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.mime }));
      recorder.stop();
    });
    this.recorder = null;
    this.chunks = [];
    if (!blob.size) {
      return null;
    }
    return {
      blob,
      thumbnail,
      durationMs,
      width: this.width,
      height: this.height,
      mimeType: this.mime,
    };
  }

  cancel() {
    window.clearTimeout(this.stopTimer);
    cancelAnimationFrame(this.raf);
    if (this.recorder) {
      try {
        this.recorder.stop();
      } catch {
        // already stopped
      }
      this.recorder = null;
    }
    this.chunks = [];
  }
}
