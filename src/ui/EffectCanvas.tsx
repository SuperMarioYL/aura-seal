import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import {
  createAuraRing,
  createBodyAura,
  createFingerTrail,
  createPalmOrb,
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
import { planAttached, type AttachedFactory } from '../effects/attachedManager';

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

interface AttachedSlot {
  actor: WebGLEffectActor;
  smooth: { x: number; y: number };
  fade: number;
  scalar: number;
  dir: { x: number; y: number };
}

const ATTACHED_FACTORY: Record<
  AttachedFactory,
  (preset: EffectPreset, width: number) => WebGLEffectActor
> = {
  aura_ring: createAuraRing,
  palm_orb: createPalmOrb,
  finger_trail: createFingerTrail,
  body_aura: createBodyAura,
};

export const EffectCanvas = forwardRef<EffectCanvasHandle, EffectCanvasProps>(function EffectCanvas(
  { trigger, actorCap = 8, landmarkRef },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }), []);
  const actorsRef = useRef<WebGLEffectActor[]>([]);
  const attachedRef = useRef<Map<string, AttachedSlot>>(new Map());
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
    const attachedMap = attachedRef.current; // stable Map reference (never reassigned)

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

    // Per-frame hand-following update (P2): plan which attached effects should exist
    // (stable ids via handedness), resolve each anchor from the latest landmark, smooth
    // it (15Hz detection → 60Hz draw), and fade actors in/out as they appear/disappear.
    const updateAttached = (now: number, dt: number) => {
      const lm = landmarkRef?.current ?? null;
      const { width, height } = sizeRef.current;
      const map = attachedMap;
      const specs = lm ? planAttached(lm, lm.quality ?? 0) : [];
      const k = 1 - Math.exp(-dt / SMOOTH_TAU);
      const live = new Set<string>();

      for (const spec of specs) {
        const resolved = resolveAnchor(spec.anchorKind, lm!, Math.max(0, spec.handIndex));
        if (!resolved.found) {
          continue;
        }
        live.add(spec.id);
        const target = coverMap(
          resolved.pos.x,
          resolved.pos.y,
          lm!.videoWidth,
          lm!.videoHeight,
          width,
          height,
        );
        let slot = map.get(spec.id);
        if (!slot) {
          const actor = ATTACHED_FACTORY[spec.factory](auraPreset, width);
          scene.add(actor.group);
          slot = {
            actor,
            smooth: { ...target },
            fade: 0,
            scalar: resolved.scalar,
            dir: resolved.dir,
          };
          map.set(spec.id, slot);
        }
        slot.smooth.x += (target.x - slot.smooth.x) * k;
        slot.smooth.y += (target.y - slot.smooth.y) * k;
        slot.scalar = resolved.scalar;
        slot.dir = resolved.dir;
        slot.fade = Math.min(1, slot.fade + (dt * 1000) / FADE_IN_MS);
        slot.actor.attachUpdate?.(slot.smooth, slot.scalar, slot.dir, slot.fade, now);
      }

      for (const [id, slot] of map) {
        if (live.has(id)) {
          continue;
        }
        slot.fade = Math.max(0, slot.fade - (dt * 1000) / FADE_OUT_MS);
        slot.actor.attachUpdate?.(slot.smooth, slot.scalar, slot.dir, slot.fade, now);
        if (slot.fade <= 0) {
          scene.remove(slot.actor.group);
          slot.actor.dispose();
          map.delete(id);
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
      attachedMap.forEach((slot) => slot.actor.dispose());
      attachedMap.clear();
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
