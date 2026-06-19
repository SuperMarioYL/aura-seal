import { useCallback, useRef, useState } from 'react';
import { PermissionGate } from '../ui/PermissionGate';
import { HeaderBar } from '../ui/HeaderBar';
import { LeftPanel, RightPanel } from '../ui/SidePanels';
import { StatusBar } from '../ui/StatusBar';
import { EffectCanvas, type EffectCanvasHandle } from '../ui/EffectCanvas';
import { GestureHintBar } from '../ui/GestureHintBar';
import { ScreenshotPreview } from '../ui/ScreenshotPreview';
import { presetForGesture } from '../effects/presets';
import type { EffectPreset } from '../effects/types';
import type { AppMode, GestureEvent } from '../vision/types';
import { useCamera } from './useCamera';
import { useVisionLoop } from '../vision/useVisionLoop';
import { manualTriggerForGesture } from '../vision/gestureGuides';
import { captureComposite, type CaptureResult } from '../recording/capture';

export function AuraSealApp() {
  const camera = useCamera();
  const [mode, setMode] = useState<AppMode>('auto');
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false);
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [recentGestures, setRecentGestures] = useState<GestureEvent[]>([]);
  const [latestGesture, setLatestGesture] = useState<GestureEvent | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const effectCanvasRef = useRef<EffectCanvasHandle>(null);
  const [effectTrigger, setEffectTrigger] = useState<{
    preset: EffectPreset;
    anchor: { x: number; y: number };
    secondaryAnchor?: { x: number; y: number };
    direction?: { x: number; y: number };
    nonce: number;
  } | null>(null);

  const handleCapture = useCallback(async () => {
    const video = camera.videoRef.current;
    if (!video) {
      return;
    }
    const result = await captureComposite(video, effectCanvasRef.current?.getCanvas() ?? null);
    if (result) {
      setCaptureResult(result);
    }
  }, [camera.videoRef]);

  const triggerEffect = useCallback(
    (
      preset: EffectPreset,
      anchor = { x: 0.5, y: 0.52 },
      direction = { x: 0, y: -1 },
      secondaryAnchor?: { x: number; y: number },
    ) => {
      setEffectTrigger({ preset, anchor, direction, secondaryAnchor, nonce: performance.now() });
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
        onCapture={handleCapture}
        captureEnabled={camera.status === 'ready'}
      />

      <section className="camera-stage" aria-label="AuraSeal 全屏摄像头工作区">
        <div className="video-stage">
          <video
            ref={camera.videoRef}
            className="camera-feed"
            muted
            playsInline
            autoPlay
            aria-label="实时摄像头画面"
          />
          <div className="stage-grid" aria-hidden="true" />
          <EffectCanvas ref={effectCanvasRef} trigger={effectTrigger} />
          <div className="hud-top">
            <span>LOCAL CAMERA</span>
            <strong>{latestGesture?.label ?? '等待动作'}</strong>
          </div>
          <PermissionGate status={camera.status} error={camera.error} onStart={camera.start} />
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
      </section>

      <ScreenshotPreview
        result={captureResult}
        onClose={() => setCaptureResult(null)}
        onRetake={() => {
          setCaptureResult(null);
          void handleCapture();
        }}
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
