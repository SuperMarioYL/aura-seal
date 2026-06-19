import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { PermissionGate } from '../ui/PermissionGate';
import { HeaderBar } from '../ui/HeaderBar';
import { LeftPanel, RightPanel } from '../ui/SidePanels';
import { StatusBar } from '../ui/StatusBar';
import type { EffectCanvasHandle } from '../ui/EffectCanvas';
import { GestureHintBar } from '../ui/GestureHintBar';
import { HitFeedback } from '../ui/HitFeedback';
import { ScreenshotPreview } from '../ui/ScreenshotPreview';
import { CaptureBar } from '../ui/CaptureBar';
import { WorksGallery } from '../ui/WorksGallery';
import { presetForGesture } from '../effects/presets';
import type { EffectPreset } from '../effects/types';
import type { AppMode, GestureEvent } from '../vision/types';
import { useCamera } from './useCamera';
import { useVisionLoop } from '../vision/useVisionLoop';
import { manualTriggerForGesture } from '../vision/gestureGuides';
import { captureComposite, type CaptureResult } from '../recording/capture';
import { useRecorder } from '../recording/useRecorder';
import { saveClip, makeId } from '../recording/storage';
import { audioEngine } from '../audio/audioEngine';

// Lazily loaded so three.js stays out of the first-paint bundle; mounted only after
// the camera is granted (v0.7).
const EffectCanvas = lazy(() =>
  import('../ui/EffectCanvas').then((m) => ({ default: m.EffectCanvas })),
);

export function AuraSealApp() {
  const camera = useCamera();
  const [mode, setMode] = useState<AppMode>('auto');
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false);
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [recentGestures, setRecentGestures] = useState<GestureEvent[]>([]);
  const [latestGesture, setLatestGesture] = useState<GestureEvent | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [worksOpen, setWorksOpen] = useState(false);
  const [worksReloadKey, setWorksReloadKey] = useState(0);
  const effectCanvasRef = useRef<EffectCanvasHandle>(null);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const [effectTrigger, setEffectTrigger] = useState<{
    preset: EffectPreset;
    anchor: { x: number; y: number };
    secondaryAnchor?: { x: number; y: number };
    direction?: { x: number; y: number };
    nonce: number;
  } | null>(null);

  const [muted, setMuted] = useState(audioEngine.muted);
  const [bgmOn, setBgmOn] = useState(audioEngine.bgmOn);

  const getEffectCanvas = useCallback(() => effectCanvasRef.current?.getCanvas() ?? null, []);
  const getAudioStream = useCallback(() => audioEngine.audioStream, []);
  const recorder = useRecorder(() => camera.videoRef.current, getEffectCanvas, getAudioStream);

  const handleStart = useCallback(() => {
    void audioEngine.resume();
    camera.start();
  }, [camera]);

  const handleCapture = useCallback(async () => {
    const video = camera.videoRef.current;
    if (!video) {
      return;
    }
    const result = await captureComposite(video, getEffectCanvas());
    if (result) {
      setCaptureResult(result);
    }
  }, [camera.videoRef, getEffectCanvas]);

  const handleToggleRecord = useCallback(() => {
    if (recorder.isRecording) {
      recorder.stop();
      return;
    }
    recorder.start(async (clip) => {
      if (!clip) {
        return;
      }
      try {
        await saveClip({
          id: makeId(),
          createdAt: Date.now(),
          durationMs: clip.durationMs,
          width: clip.width,
          height: clip.height,
          mimeType: clip.mimeType,
          thumbnail: clip.thumbnail,
          blob: clip.blob,
        });
        setWorksReloadKey((key) => key + 1);
        setWorksOpen(true);
      } catch (err) {
        console.warn('[AuraSeal] failed to save clip', err);
      }
    });
  }, [recorder]);

  const triggerEffect = useCallback(
    (
      preset: EffectPreset,
      anchor = { x: 0.5, y: 0.52 },
      direction = { x: 0, y: -1 },
      secondaryAnchor?: { x: number; y: number },
    ) => {
      setEffectTrigger({ preset, anchor, direction, secondaryAnchor, nonce: performance.now() });
      audioEngine.playSfx(preset.id);
    },
    [],
  );

  const onGesture = useCallback(
    (gesture: GestureEvent) => {
      setLatestGesture(gesture);
      setRecentGestures((items) => [gesture, ...items].slice(0, 6));
      triggerEffect(
        presetForGesture(gesture.kind),
        gesture.anchor,
        gesture.direction,
        gesture.secondaryAnchor,
      );
    },
    [triggerEffect],
  );

  const vision = useVisionLoop({
    videoRef: camera.videoRef,
    enabled: camera.status === 'ready' && mode === 'auto',
    onGesture,
  });

  return (
    <main className="app-shell">
      <HeaderBar
        mode={mode}
        onModeChange={setMode}
        cameraStatus={camera.status}
        visionStatus={vision.status}
        animationPanelOpen={animationPanelOpen}
        actionPanelOpen={actionPanelOpen}
        onToggleAnimationPanel={() => setAnimationPanelOpen((open) => !open)}
        onToggleActionPanel={() => setActionPanelOpen((open) => !open)}
        muted={muted}
        bgmOn={bgmOn}
        onToggleMute={() => setMuted(audioEngine.toggleMute())}
        onToggleBgm={() => {
          void audioEngine.resume();
          setBgmOn(audioEngine.toggleBgm());
        }}
      />

      <section className="camera-stage" aria-label="AuraSeal 全屏摄像头工作区">
        <div className="video-stage" ref={videoStageRef}>
          <video
            ref={camera.videoRef}
            className="camera-feed"
            muted
            playsInline
            autoPlay
            aria-label="实时摄像头画面"
          />
          <div className="stage-grid" aria-hidden="true" />
          {camera.status === 'ready' ? (
            <Suspense fallback={null}>
              <EffectCanvas
                ref={effectCanvasRef}
                trigger={effectTrigger}
                actorCap={vision.actorCap}
              />
            </Suspense>
          ) : null}
          {effectTrigger ? (
            <HitFeedback
              nonce={effectTrigger.nonce}
              color={effectTrigger.preset.palette.glow}
              shakeTarget={videoStageRef}
            />
          ) : null}
          <div className="hud-top">
            <span>LOCAL CAMERA</span>
            <strong>{latestGesture?.label ?? '等待动作'}</strong>
          </div>
          <PermissionGate status={camera.status} error={camera.error} onStart={handleStart} />
        </div>

        {animationPanelOpen ? (
          <div className="floating-panel left-floating">
            <LeftPanel
              snapshot={vision.snapshot}
              recentGestures={recentGestures}
              onManualTrigger={triggerEffect}
              manualEnabled={mode === 'manual' && camera.status === 'ready'}
              activeGesture={latestGesture}
            />
          </div>
        ) : null}

        {actionPanelOpen ? (
          <div className="floating-panel right-floating">
            <RightPanel
              snapshot={vision.snapshot}
              recentGestures={recentGestures}
              onManualTrigger={(preset) => {
                const manual = manualTriggerForGesture(preset.gesture);
                triggerEffect(preset, manual.anchor, manual.direction);
              }}
              manualEnabled={mode === 'manual' && camera.status === 'ready'}
              activeGesture={latestGesture}
            />
          </div>
        ) : null}

        <GestureHintBar
          cameraStatus={camera.status}
          mode={mode}
          snapshot={vision.snapshot}
          latestGesture={latestGesture}
          degraded={vision.degraded}
        />

        <CaptureBar
          visible={camera.status === 'ready'}
          onCapture={handleCapture}
          canRecord={recorder.supported}
          isRecording={recorder.isRecording}
          elapsedMs={recorder.elapsedMs}
          onToggleRecord={handleToggleRecord}
          onOpenWorks={() => setWorksOpen(true)}
        />
      </section>

      <ScreenshotPreview
        result={captureResult}
        onClose={() => setCaptureResult(null)}
        onRetake={() => {
          setCaptureResult(null);
          void handleCapture();
        }}
      />

      <WorksGallery
        open={worksOpen}
        reloadKey={worksReloadKey}
        onClose={() => setWorksOpen(false)}
      />

      <StatusBar
        mode={mode}
        cameraStatus={camera.status}
        visionStatus={vision.status}
        latestGesture={latestGesture}
        fps={vision.snapshot.fps}
        visionError={vision.error}
      />
    </main>
  );
}
