import * as THREE from 'three';
import type { EffectPreset } from '../types';
import { createRuntimeEffect, type WebGLEffectActor } from '../webglRenderer';

const TAU = Math.PI * 2;

// Overhaul P5 — GPU particle burst for big casts (spells / combos / energy orb). All the
// motion is in the vertex shader (outward velocity + per-particle curl-ish swirl over
// life), so it's cheap and "alive" compared to the old static seeded point clouds.
export function createParticleBurst(
  preset: EffectPreset,
  width: number,
  height: number,
  count = 130,
): WebGLEffectActor {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const velocity = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const reach = Math.min(width, height) * 0.55;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const speed = (0.35 + Math.random() * 0.65) * reach;
    velocity[i * 3] = Math.cos(angle) * speed;
    velocity[i * 3 + 1] = Math.sin(angle) * speed;
    velocity[i * 3 + 2] = 0;
    seed[i] = Math.random();
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aVel', new THREE.BufferAttribute(velocity, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(preset.palette.spark) },
      uSize: { value: Math.max(3, width * 0.005) },
      uSwirl: { value: Math.min(width, height) * 0.06 },
    },
    vertexShader: `
      attribute vec3 aVel;
      attribute float aSeed;
      uniform float uProgress;
      uniform float uSize;
      uniform float uSwirl;
      varying float vAlpha;
      void main() {
        float t = uProgress;
        float ease = 1.0 - pow(1.0 - t, 3.0);          // fast out, slow settle
        float swirlX = sin(aSeed * 6.2831 + t * 6.0) * uSwirl * t;
        float swirlY = cos(aSeed * 6.2831 + t * 5.0) * uSwirl * t;
        vec3 p = position + aVel * ease + vec3(swirlX, swirlY, 0.0);
        vAlpha = (1.0 - t) * (0.5 + 0.5 * aSeed);
        gl_PointSize = uSize * (1.0 - t * 0.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float a = smoothstep(0.5, 0.08, d) * vAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  group.add(new THREE.Points(geometry, material));
  const runtime = createRuntimeEffect(preset, { x: 0.5, y: 0.5 });
  runtime.durationMs = 1100;

  return {
    id: `nova-${runtime.id}`,
    runtime,
    group,
    mode: 'transient',
    update: (progress) => {
      // Reset scale each frame — updateWebGLEffect applies a burst overshoot via
      // multiplyScalar afterwards, which would compound without this.
      group.scale.setScalar(1);
      material.uniforms.uProgress.value = progress;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
