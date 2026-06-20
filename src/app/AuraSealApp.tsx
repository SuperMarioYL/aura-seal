import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PermissionGate } from '../ui/PermissionGate';
import { HeaderBar } from '../ui/HeaderBar';
import { LeftPanel, RightPanel } from '../ui/SidePanels';
import { StatusBar } from '../ui/StatusBar';
import type { EffectCanvasHandle } from '../ui/EffectCanvas';
import { GestureHintBar } from '../ui/GestureHintBar';
import { HitFeedback } from '../ui/HitFeedback';
import { Onboarding } from '../ui/Onboarding';
import { hasOnboarded } from '../ui/onboardingState';
import { ScreenshotPreview } from '../ui/ScreenshotPreview';
import { CaptureBar } from '../ui/CaptureBar';
import { WorksGallery } from '../ui/WorksGallery';
import { ScoreHUD } from '../ui/ScoreHUD';
import { StatsOverlay } from '../ui/StatsOverlay';
import { presetForGesture, presetById } from '../effects/presets';
import type { EffectPreset } from '../effects/types';
import type { AppMode, GestureEvent } from '../vision/types';
import { useCamera } from './useCamera';
import { useVisionLoop } from '../vision/useVisionLoop';
import { manualTriggerForGesture } from '../vision/gestureGuides';
import { captureComposite, type CaptureResult } from '../recording/capture';
import { useRecorder } from '../recording/useRecorder';
import { saveClip, makeId } from '../recording/storage';
import { audioEngine } from '../audio/audioEngine';
import { usePlay } from '../play/usePlay';
import { applySkin, loadSkin, saveSkin, SKINS } from '../play/skins';

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
  const [onboarded, setOnboarded] = useState(hasOnboarded);
  const [cinema, setCinema] = useState(() => {
    try {
      return localStorage.getItem('auraseal.cinema') === '1';
    } catch {
      return false;
    }
  });
  const toggleCinema = useCallback(() => {
    setCinema((on) => {
      const next = !on;
      try {
        localStorage.setItem('auraseal.cinema', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  const play = usePlay();
  const skinRef = useRef(loadSkin());
  const [skinName, setSkinName] = useState(skinRef.current.name);

  const cycleSkin = useCallback(() => {
    const index = SKINS.findIndex((s) => s.id === skinRef.current.id);
    const next = SKINS[(index + 1) % SKINS.length];
    skinRef.current = next;
    saveSkin(next);
    setSkinName(next.name);
  }, []);

  const [customHue, setCustomHue] = useState(() => {
    try {
      const v = Number(localStorage.getItem('auraseal.customhue'));
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  });
  const onCustomHue = useCallback((deg: number) => {
    setCustomHue(deg);
    try {
      localStorage.setItem('auraseal.customhue', String(deg));
    } catch {
      // ignore
    }
    skinRef.current = { id: 'custom', name: '自定义', hue: deg };
    setSkinName('自定义');
  }, []);

  const [debug, setDebug] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        setDebug((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      // Re-tint the palette by the active skin (v0.9), then cast.
      const palette = applySkin(preset.palette, skinRef.current);
      const skinned = palette === preset.palette ? preset : { ...preset, palette };
      setEffectTrigger({
        preset: skinned,
        anchor,
        direction,
        secondaryAnchor,
        nonce: performance.now(),
      });
      audioEngine.playSfx(preset.id);
    },
    [],
  );

  const playOnGesture = play.onGesture;
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

      // Score the cast and, if it completes a combo sequence, fire a stronger ultimate.
      const comboEffect = playOnGesture(gesture);
      if (comboEffect) {
        const base = presetById(comboEffect);
        triggerEffect(
          { ...base, intensity: 1, durationMs: Math.round(base.durationMs * 1.3) },
          { x: 0.5, y: 0.46 },
          { x: 0, y: -1 },
        );
      }
    },
    [triggerEffect, playOnGesture],
  );

  const vision = useVisionLoop({
    videoRef: camera.videoRef,
    enabled: camera.status === 'ready' && mode === 'auto',
    onGesture,
  });

  const onboardingActive = camera.status === 'ready' && mode === 'auto' && !onboarded;

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
        skinName={skinName}
        onCycleSkin={cycleSkin}
        cinema={cinema}
        onToggleCinema={toggleCinema}
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
                landmarkRef={vision.landmarkRef}
                cinema={cinema}
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
          {camera.status === 'ready' && mode === 'auto' ? (
            <ScoreHUD score={play.score} flash={play.flash} combo={play.combo} />
          ) : null}
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
              customHue={customHue}
              onCustomHue={onCustomHue}
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

        {onboardingActive ? null : (
          <GestureHintBar
            cameraStatus={camera.status}
            mode={mode}
            snapshot={vision.snapshot}
            latestGesture={latestGesture}
            degraded={vision.degraded}
          />
        )}

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

      {onboardingActive ? (
        <Onboarding
          snapshot={vision.snapshot}
          latestGesture={latestGesture}
          onClose={() => setOnboarded(true)}
        />
      ) : null}

      {debug && camera.status === 'ready' ? (
        <StatsOverlay
          snapshot={vision.snapshot}
          quality={vision.quality}
          degraded={vision.degraded}
        />
      ) : null}

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
