import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  createRuntimeEffect,
  createWebGLEffect,
  updateWebGLEffect,
  type WebGLEffectActor,
} from '../effects/webglRenderer';
import type { EffectPreset, EffectRuntime } from '../effects/types';

interface EffectCanvasProps {
  trigger: {
    preset: EffectPreset;
    anchor: { x: number; y: number };
    secondaryAnchor?: { x: number; y: number };
    direction?: { x: number; y: number };
    nonce: number;
  } | null;
  /** Max concurrent effect actors — lowered by the FPS-adaptive quality level (v0.7). */
  actorCap?: number;
}

export interface EffectCanvasHandle {
  /** The live WebGL canvas, for compositing screenshots/recordings. */
  getCanvas: () => HTMLCanvasElement | null;
}

export const EffectCanvas = forwardRef<EffectCanvasHandle, EffectCanvasProps>(function EffectCanvas(
  { trigger, actorCap = 8 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }), []);
  const effectsRef = useRef<EffectRuntime[]>([]);
  const actorsRef = useRef<WebGLEffectActor[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!trigger || !scene) {
      return;
    }

    const runtime = createRuntimeEffect(
      trigger.preset,
      trigger.anchor,
      trigger.direction,
      trigger.secondaryAnchor,
    );
    const actor = createWebGLEffect(runtime, sizeRef.current.width, sizeRef.current.height);
    scene.add(actor.group);

    const cap = Math.max(2, actorCap);
    effectsRef.current = [...effectsRef.current, runtime].slice(-cap);
    actorsRef.current = [...actorsRef.current, actor];
    while (actorsRef.current.length > cap) {
      const [stale, ...rest] = actorsRef.current;
      scene.remove(stale.group);
      stale.dispose();
      actorsRef.current = rest;
    }
  }, [trigger, actorCap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -100, 100);

    // WebGL may be unavailable (no GPU context, blocklisted driver, headless env).
    // Degrade gracefully: disable the effects layer but keep camera/recognition/UI
    // alive, instead of letting the failure bubble up and blank the whole app.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
        // Keep the drawing buffer so screenshots/recordings can read the effects layer.
        preserveDrawingBuffer: true,
      });
    } catch (err) {
      console.warn('[AuraSeal] WebGL unavailable — effects disabled', err);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    let frame = 0;
    let mounted = true;
    let contextLost = false;

    // Size is driven by a ResizeObserver instead of a getBoundingClientRect() on
    // every draw() — the per-frame read forced a synchronous layout each frame.
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
        const { width, height } = entry.contentRect;
        applySize(width, height);
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

    const draw = (now: number) => {
      if (!mounted) {
        return;
      }

      if (!contextLost) {
        actorsRef.current = actorsRef.current.filter((actor) => {
          const alive = updateWebGLEffect(actor, now);
          if (!alive) {
            scene.remove(actor.group);
          }
          return alive;
        });
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
      renderer.forceContextLoss();
      renderer.dispose();
      scene.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="effect-canvas" aria-hidden="true" />;
});
