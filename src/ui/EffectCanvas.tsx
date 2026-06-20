import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import {
  createAuraRing,
  createRuntimeEffect,
  createWebGLEffect,
  updateWebGLEffect,
  type WebGLEffectActor,
} from '../effects/webglRenderer';
import type { EffectPreset, EffectRuntime } from '../effects/types';
import type { FrameFeatures } from '../vision/types';
import { resolveAnchor } from '../effects/anchors';
import { coverMap } from '../effects/coordMap';
import { presetById } from '../effects/presets';

interface EffectCanvasProps {
  trigger: {
    preset: EffectPreset;
    anchor: { x: number; y: number };
    secondaryAnchor?: { x: number; y: number };
    direction?: { x: number; y: number };
    nonce: number;
  } | null;
  /** Max concurrent transient effect actors — lowered by the FPS-adaptive quality level. */
  actorCap?: number;
  /** Live landmark channel (overhaul P1) driving hand-following attached effects. */
  landmarkRef?: RefObject<FrameFeatures | null>;
}

export interface EffectCanvasHandle {
  /** The live WebGL canvas, for compositing screenshots/recordings. */
  getCanvas: () => HTMLCanvasElement | null;
}

// Hand-following tuning.
const SMOOTH_TAU = 0.055; // critically-damped spring time constant (s)
const FADE_IN_MS = 130;
const FADE_OUT_MS = 320;
const MAX_DT = 0.05;
const MAX_HANDS = 2;

interface AttachedSlot {
  actor: WebGLEffectActor;
  smooth: { x: number; y: number };
  fade: number;
  scalar: number;
  dir: { x: number; y: number };
}

export const EffectCanvas = forwardRef<EffectCanvasHandle, EffectCanvasProps>(function EffectCanvas(
  { trigger, actorCap = 8, landmarkRef },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }), []);
  const actorsRef = useRef<WebGLEffectActor[]>([]);
  const attachedRef = useRef<Array<AttachedSlot | null>>([null, null]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });

  // Transient one-shot effects: created at trigger, mirror/cover-corrected, played once.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!trigger || !scene) {
      return;
    }

    const runtime: EffectRuntime = createRuntimeEffect(
      trigger.preset,
      trigger.anchor,
      trigger.direction,
      trigger.secondaryAnchor,
    );
    const lm = landmarkRef?.current;
    const { width, height } = sizeRef.current;
    const actor = createWebGLEffect(
      runtime,
      width,
      height,
      lm?.videoWidth || width,
      lm?.videoHeight || height,
    );
    scene.add(actor.group);

    const cap = Math.max(2, actorCap);
    actorsRef.current = [...actorsRef.current, actor];
    while (actorsRef.current.length > cap) {
      const [stale, ...rest] = actorsRef.current;
      scene.remove(stale.group);
      stale.dispose();
      actorsRef.current = rest;
    }
  }, [trigger, actorCap, landmarkRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -100, 100);

    // WebGL may be unavailable (no GPU context, blocklisted driver, headless env).
    // Degrade gracefully: disable the effects layer but keep camera/recognition/UI alive.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });
    } catch (err) {
      console.warn('[AuraSeal] WebGL unavailable — effects disabled', err);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    sceneRef.current = scene;

    let frame = 0;
    let mounted = true;
    let contextLost = false;
    let lastNow = 0;
    const auraPreset = presetById('seal');

    const applySize = (width: number, height: number) => {
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      if (sizeRef.current.width === w && sizeRef.current.height === h) {
        return;
      }
      sizeRef.current = { width: w, height: h };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
      camera.left = 0;
      camera.right = w;
      camera.top = 0;
      camera.bottom = h;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        applySize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(canvas);
    const initialRect = canvas.getBoundingClientRect();
    applySize(initialRect.width, initialRect.height);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    canvas.addEventListener('webglcontextlost', onContextLost as EventListener, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored as EventListener, false);

    // Per-frame hand-following update: read the latest landmark, resolve each hand's
    // palm anchor, smooth it (15Hz detection → 60Hz draw), and drive an aura ring that
    // fades in/out as the hand enters/leaves frame.
    const updateAttached = (now: number, dt: number) => {
      const lm = landmarkRef?.current ?? null;
      const { width, height } = sizeRef.current;
      const slots = attachedRef.current;

      for (let i = 0; i < MAX_HANDS; i += 1) {
        const resolved = lm ? resolveAnchor('hand_center', lm, i) : null;
        let slot = slots[i];

        if (resolved && resolved.found && lm) {
          const target = coverMap(
            resolved.pos.x,
            resolved.pos.y,
            lm.videoWidth,
            lm.videoHeight,
            width,
            height,
          );
          if (!slot) {
            const actor = createAuraRing(auraPreset, width);
            scene.add(actor.group);
            slot = {
              actor,
              smooth: { ...target },
              fade: 0,
              scalar: resolved.scalar,
              dir: resolved.dir,
            };
            slots[i] = slot;
          }
          const k = 1 - Math.exp(-dt / SMOOTH_TAU);
          slot.smooth.x += (target.x - slot.smooth.x) * k;
          slot.smooth.y += (target.y - slot.smooth.y) * k;
          slot.scalar = resolved.scalar;
          slot.dir = resolved.dir;
          slot.fade = Math.min(1, slot.fade + (dt * 1000) / FADE_IN_MS);
          slot.actor.attachUpdate?.(slot.smooth, slot.scalar, slot.dir, slot.fade, now);
        } else if (slot) {
          slot.fade = Math.max(0, slot.fade - (dt * 1000) / FADE_OUT_MS);
          slot.actor.attachUpdate?.(slot.smooth, slot.scalar, slot.dir, slot.fade, now);
          if (slot.fade <= 0) {
            scene.remove(slot.actor.group);
            slot.actor.dispose();
            slots[i] = null;
          }
        }
      }
    };

    const draw = (now: number) => {
      if (!mounted) {
        return;
      }
      const dt = lastNow ? Math.min(MAX_DT, (now - lastNow) / 1000) : 0.016;
      lastNow = now;

      if (!contextLost) {
        actorsRef.current = actorsRef.current.filter((actor) => {
          const alive = updateWebGLEffect(actor, now);
          if (!alive) {
            scene.remove(actor.group);
          }
          return alive;
        });
        updateAttached(now, dt);
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onContextRestored as EventListener);
      actorsRef.current.forEach((actor) => actor.dispose());
      actorsRef.current = [];
      attachedRef.current.forEach((slot) => slot?.actor.dispose());
      attachedRef.current = [null, null];
      // Do NOT forceContextLoss() — StrictMode remount reuses this canvas (see git log).
      renderer.dispose();
      scene.clear();
      sceneRef.current = null;
    };
    // landmarkRef is a stable ref object from the parent; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="effect-canvas" aria-hidden="true" />;
});
