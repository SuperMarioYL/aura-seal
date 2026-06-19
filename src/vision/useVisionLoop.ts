import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { GestureStabilizer } from './gestures';
import type { FrameFeatures, GestureEvent, Landmark, VisionSnapshot } from './types';

type VisionStatus = 'idle' | 'loading' | 'running' | 'error';

interface UseVisionLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onGesture: (gesture: GestureEvent) => void;
}

interface Landmarkers {
  hand: HandLandmarker;
  pose: PoseLandmarker | null;
}

type HandResult = {
  landmarks?: Landmark[][];
  handednesses?: Array<Array<{ categoryName?: string }>>;
};
type PoseResult = { landmarks?: Landmark[][] };

// Self-hosted, same-origin runtime (see scripts/prepare-assets.mjs). No third-party
// CDN is contacted at runtime — this is what makes "本地推理零上传" verifiable in devtools.
const WASM_BASE = '/mediapipe/wasm';
const HAND_MODEL = '/mediapipe/models/hand_landmarker.task';
const POSE_MODEL = '/mediapipe/models/pose_landmarker_lite.task';
const LOAD_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;

// v0.7 — FPS-adaptive degradation. fps used to be computed and only displayed; now it
// drives a quality level: when frames get expensive we lengthen the detection interval
// and shrink the effect actor cap, and recover when there's headroom again.
const MAX_QUALITY_LEVEL = 3;
const INTERVAL_BY_LEVEL = [66, 100, 133, 200];
const ACTOR_CAP_BY_LEVEL = [8, 6, 4, 3];
const SNAPSHOT_INTERVAL_MS = 320;
const QUALITY_CHECK_MS = 1200;

function initialQualityLevel(): number {
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 2 || mem <= 2) {
    return 2;
  }
  if (cores <= 4 || mem <= 4) {
    return 1;
  }
  return 0;
}

function withTimeout<T>(factory: () => Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 超时`)), ms);
    factory().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

async function withRetry<T>(factory: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await withTimeout(factory, LOAD_TIMEOUT_MS, label);
    } catch (reason) {
      lastError = reason;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export function useVisionLoop({ videoRef, enabled, onGesture }: UseVisionLoopOptions) {
  const [status, setStatus] = useState<VisionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [quality, setQuality] = useState(initialQualityLevel());
  const [snapshot, setSnapshot] = useState<VisionSnapshot>({
    frame: null,
    gesture: null,
    fps: 0,
    detectedHands: 0,
    hasPose: false,
  });

  const qualityRef = useRef(quality);
  const lastQualityCheckRef = useRef(0);
  const lastSnapshotMsRef = useRef(0);

  const landmarkerRef = useRef<Landmarkers | null>(null);
  const loadPromiseRef = useRef<Promise<Landmarkers> | null>(null);
  const stabilizerRef = useRef(new GestureStabilizer());
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectMsRef = useRef(0);
  const framesRef = useRef({ count: 0, since: performance.now(), fps: 0 });
  const onGestureRef = useRef(onGesture);

  // Cached per-modality results so interleaved detection can still emit a full frame.
  const lastHandResultRef = useRef<HandResult>({ landmarks: [], handednesses: [] });
  const lastPoseResultRef = useRef<PoseResult>({ landmarks: [] });
  const detectHandTurnRef = useRef(true);

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  const load = useCallback(async (): Promise<Landmarkers> => {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }
    // Dedupe concurrent loads — StrictMode mounts effects twice in dev, which would
    // otherwise create two full sets of landmarkers and double GPU/memory cost.
    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    const promise = (async () => {
      setStatus('loading');
      setError(null);
      setDegraded(false);

      const fileset = await withRetry(() => FilesetResolver.forVisionTasks(WASM_BASE), '运行时');
      const hand = await withRetry(
        () =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.48,
            minHandPresenceConfidence: 0.48,
            minTrackingConfidence: 0.48,
          }),
        '手部模型',
      );

      let pose: PoseLandmarker | null = null;
      try {
        pose = await withRetry(
          () =>
            PoseLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.45,
              minPosePresenceConfidence: 0.45,
              minTrackingConfidence: 0.45,
            }),
          '姿态模型',
        );
      } catch (reason) {
        // Degrade gracefully: hand-only still drives many gestures.
        console.warn('[AuraSeal] pose model failed, degrading to hand-only', reason);
        setDegraded(true);
      }

      landmarkerRef.current = { hand, pose };
      return landmarkerRef.current;
    })();

    loadPromiseRef.current = promise;
    promise.catch(() => {
      // Allow a later retry after a failed load.
      loadPromiseRef.current = null;
    });
    return promise;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!enabled) {
        setStatus('idle');
        stabilizerRef.current.reset();
        return;
      }

      try {
        const landmarkers = await load();
        if (cancelled) {
          return;
        }
        setStatus('running');
        loop(landmarkers);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : '模型加载失败';
        setStatus('error');
        setError(message);
      }
    }

    function loop(landmarkers: Landmarkers) {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        rafRef.current = requestAnimationFrame(() => loop(landmarkers));
        return;
      }

      const timestampMs = performance.now();
      const shouldDetect =
        video.currentTime !== lastVideoTimeRef.current &&
        timestampMs - lastDetectMsRef.current >= INTERVAL_BY_LEVEL[qualityRef.current];

      if (shouldDetect) {
        lastVideoTimeRef.current = video.currentTime;
        lastDetectMsRef.current = timestampMs;

        // Interleave the two models: run only one per tick so a single frame budget
        // carries one inference instead of two. Each modality refreshes every other
        // tick; the other is served from cache. Halves per-tick inference cost.
        const runHand = landmarkers.pose === null || detectHandTurnRef.current;
        if (runHand) {
          lastHandResultRef.current = landmarkers.hand.detectForVideo(video, timestampMs);
        } else {
          lastPoseResultRef.current = landmarkers.pose!.detectForVideo(video, timestampMs);
        }
        detectHandTurnRef.current = !detectHandTurnRef.current;

        const frame = toFrameFeatures(
          lastHandResultRef.current,
          lastPoseResultRef.current,
          timestampMs,
          video,
        );
        const gesture = stabilizerRef.current.push(frame);
        const fps = updateFps(timestampMs);

        if (gesture) {
          onGestureRef.current(gesture);
        }

        adjustQuality(timestampMs, fps);

        // Throttle the React snapshot: panels only show fps/hand/pose counts, which
        // don't need the full ~15Hz detection rate. Emit a cast frame immediately so a
        // triggered gesture surfaces at once, otherwise update at ~3Hz.
        if (gesture || timestampMs - lastSnapshotMsRef.current >= SNAPSHOT_INTERVAL_MS) {
          lastSnapshotMsRef.current = timestampMs;
          setSnapshot({
            frame,
            gesture,
            fps,
            detectedHands: frame.hands.length,
            hasPose: frame.pose.length > 0,
          });
        }
      }

      rafRef.current = requestAnimationFrame(() => loop(landmarkers));
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    };
  }, [enabled, load, videoRef]);

  useEffect(() => {
    return () => {
      landmarkerRef.current?.hand.close();
      landmarkerRef.current?.pose?.close();
      landmarkerRef.current = null;
    };
  }, []);

  function updateFps(now: number) {
    const state = framesRef.current;
    state.count += 1;
    const elapsed = now - state.since;
    if (elapsed > 500) {
      state.fps = Math.round((state.count / elapsed) * 1000);
      state.count = 0;
      state.since = now;
    }
    return state.fps;
  }

  function adjustQuality(now: number, fps: number) {
    if (fps <= 0 || now - lastQualityCheckRef.current < QUALITY_CHECK_MS) {
      return;
    }
    lastQualityCheckRef.current = now;
    let level = qualityRef.current;
    if (fps < 22 && level < MAX_QUALITY_LEVEL) {
      level += 1; // under budget — shed work
    } else if (fps > 40 && level > 0) {
      level -= 1; // headroom — recover quality
    }
    if (level !== qualityRef.current) {
      qualityRef.current = level;
      setQuality(level);
    }
  }

  return {
    status,
    error,
    snapshot,
    degraded,
    quality,
    actorCap: ACTOR_CAP_BY_LEVEL[quality],
  };
}

function toFrameFeatures(
  handResult: HandResult,
  poseResult: PoseResult,
  timestampMs: number,
  video: HTMLVideoElement,
): FrameFeatures {
  return {
    hands: handResult.landmarks ?? [],
    handedness: (handResult.handednesses ?? []).map(
      (entries) => entries[0]?.categoryName ?? 'Unknown',
    ),
    pose: poseResult.landmarks?.[0] ?? [],
    timestampMs,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  };
}
