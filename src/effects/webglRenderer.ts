import * as THREE from 'three';
import type { EffectPreset, EffectRuntime } from './types';
import { coverMap, mirrorDir } from './coordMap';

type Vec = { x: number; y: number };

const TAU = Math.PI * 2;

export interface WebGLEffectActor {
  id: string;
  runtime: EffectRuntime;
  group: THREE.Group;
  update: (progress: number, elapsedMs: number) => void;
  dispose: () => void;
  /** transient = one-shot burst (default); attached = follows a live landmark each frame. */
  mode?: 'transient' | 'attached';
  /** Attached actors: called every draw frame with the smoothed world anchor. */
  attachUpdate?: (world: Vec, scalar: number, dir: Vec, fade: number, now: number) => void;
}

export function createRuntimeEffect(
  preset: EffectPreset,
  anchor: Vec,
  direction: Vec = { x: 0, y: -1 },
  secondaryAnchor?: Vec,
  now = performance.now(),
): EffectRuntime {
  return {
    id: `${preset.id}-${Math.round(now)}-${Math.random().toString(36).slice(2)}`,
    preset,
    anchor,
    secondaryAnchor,
    direction: normalize(direction),
    startedAt: now,
    durationMs: preset.durationMs,
    seed: Math.random() * 1000,
  };
}

export function createWebGLEffect(
  runtime: EffectRuntime,
  width: number,
  height: number,
  videoW = width,
  videoH = height,
): WebGLEffectActor {
  // Mirror + cover-correct so transient effects line up with the displayed (mirrored)
  // hand, same mapping the attached/hand-following path uses.
  const anchor = coverMap(runtime.anchor.x, runtime.anchor.y, videoW, videoH, width, height);
  const secondary = runtime.secondaryAnchor
    ? coverMap(runtime.secondaryAnchor.x, runtime.secondaryAnchor.y, videoW, videoH, width, height)
    : undefined;
  const direction = normalize(mirrorDir(runtime.direction));
  const group = new THREE.Group();
  group.position.set(anchor.x, anchor.y, 0);

  const actor = buildActor(runtime, group, anchor, secondary, direction, width, height);
  // v0.3: an alpha-correct soft halo + intensity-driven brightness give the "辉光"
  // over-exposure look directly in-scene, without a post-processing pass that would
  // risk blacking out the transparent overlay above the camera feed.
  addGlow(actor, runtime, width, height);
  applyIntensity(actor, runtime);
  return actor;
}

function buildActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  anchor: Vec,
  secondary: Vec | undefined,
  direction: Vec,
  width: number,
  height: number,
): WebGLEffectActor {
  switch (runtime.preset.id) {
    case 'seal':
      return createSealActor(runtime, group, width);
    case 'shockwave':
      return createShockwaveActor(runtime, group, direction, width, height);
    case 'energy_orb':
      return createOrbActor(runtime, group, anchor, secondary, width);
    case 'speed_lines':
      return createRushActor(runtime, group, direction, width, height);
    case 'light_column':
      return createColumnActor(runtime, group, height, width);
    case 'aura_burst':
      return createBurstActor(runtime, group, width, height);
    case 'barrier':
      return createBarrierActor(runtime, group, width);
    case 'skyfall':
      return createSkyfallActor(runtime, group, width, height);
    case 'guard_flare':
      return createGuardActor(runtime, group, width, height);
    case 'beam':
      return createBeamActor(runtime, group, direction, width, height);
    case 'slash':
      return createSlashActor(runtime, group, direction, width);
    default:
      // Unknown preset id: never return undefined (that previously bubbled up as a
      // white screen). Fall back to a harmless empty actor that fades out immediately.
      console.warn('[AuraSeal] unknown effect preset', runtime.preset.id);
      return baseActor(runtime, group);
  }
}

function addGlow(actor: WebGLEffectActor, runtime: EffectRuntime, width: number, height: number) {
  const base = Math.min(width, height);
  const radius = base * (0.12 + runtime.preset.intensity * 0.08);
  actor.group.add(createGlowDisc(radius, runtime.preset.palette.glow, 0.5));
}

function applyIntensity(actor: WebGLEffectActor, runtime: EffectRuntime) {
  // Weak moves stay restrained, strong moves push toward over-exposure. Read by setOpacity.
  actor.group.userData.baseBrightness = 0.55 + runtime.preset.intensity * 0.5;
  actor.group.userData.brightness = actor.group.userData.baseBrightness;
}

// v0.6 — charge → burst → dissipate. A sharp spike near the start gives each cast a
// "snap" (anticipation into a burst peak, then decay) instead of a flat fade.
const BURST_AT = 0.13;
function burstCurve(progress: number): number {
  if (progress < BURST_AT) {
    return easeOut(progress / BURST_AT);
  }
  return Math.exp(-(progress - BURST_AT) * 6.5);
}

export function updateWebGLEffect(actor: WebGLEffectActor, now: number): boolean {
  const elapsed = now - actor.runtime.startedAt;
  const progress = clamp01(elapsed / actor.runtime.durationMs);
  if (progress >= 1) {
    actor.dispose();
    return false;
  }

  // Drive the burst before the actor paints itself so setOpacity picks up the spike,
  // then add a transform overshoot on top of whatever scale the actor set.
  const burst = burstCurve(progress);
  const base = (actor.group.userData.baseBrightness as number | undefined) ?? 1;
  actor.group.userData.brightness = base * (1 + burst * 0.85);
  actor.update(progress, elapsed);
  actor.group.scale.multiplyScalar(1 + burst * 0.14);
  return true;
}

function createSealActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  width: number,
): WebGLEffectActor {
  const color = runtime.preset.palette.mid;
  const accent = runtime.preset.palette.spark;
  const radius = width * 0.09;

  group.add(createRing(radius, color, 0.82, 2.4));
  group.add(createRing(radius * 0.68, runtime.preset.palette.core, 0.72, 1.5));
  for (let i = 0; i < 12; i += 1) {
    const angle = (TAU / 12) * i;
    const spoke = createLineMesh(
      [
        { x: Math.cos(angle) * radius * 0.42, y: Math.sin(angle) * radius * 0.42 },
        { x: Math.cos(angle) * radius * 0.92, y: Math.sin(angle) * radius * 0.92 },
      ],
      width * 0.0022,
      i % 3 === 0 ? accent : color,
      0.72,
    );
    group.add(spoke);
  }
  group.add(createPointsCloud(42, radius * 1.25, accent, 0.72, runtime.seed, 3.5));

  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    const alpha = fade(progress);
    group.rotation.z = elapsedMs * 0.0011 + runtime.seed;
    group.scale.setScalar(0.74 + easeOut(progress) * 0.42);
    setOpacity(group, alpha);
  };
  return actor;
}

function createShockwaveActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  direction: Vec,
  width: number,
  height: number,
): WebGLEffectActor {
  group.rotation.z = Math.atan2(direction.y, direction.x);
  const length = Math.min(width, height) * 0.56;
  const spread = Math.min(width, height) * 0.13;

  for (let i = 0; i < 5; i += 1) {
    const y = (i - 2) * spread * 0.22;
    const points = [
      { x: 0, y },
      { x: length * 0.25, y: y - spread * (0.44 + i * 0.03) },
      { x: length * 0.6, y: y + spread * (0.3 + i * 0.04) },
      { x: length, y: y - spread * 0.12 },
    ];
    group.add(
      createRibbonMesh(
        sampleCubic(points, 34),
        Math.max(12, width * (0.014 - i * 0.0014)),
        Math.max(2, width * 0.002),
        i < 2 ? runtime.preset.palette.core : runtime.preset.palette.mid,
        0.72 - i * 0.08,
      ),
    );
  }

  group.add(createRing(spread * 0.96, runtime.preset.palette.core, 0.48, 1.4));
  group.add(createRing(spread * 1.34, runtime.preset.palette.mid, 0.34, 1.1));
  group.add(
    createForwardParticles(
      58,
      length * 1.05,
      spread * 1.65,
      runtime.preset.palette.spark,
      0.62,
      runtime.seed,
      4,
    ),
  );

  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    const alpha = fade(progress);
    group.scale.set(0.55 + easeOut(progress) * 0.55, 0.84 + easeOut(progress) * 0.2, 1);
    group.position.x += Math.cos(group.rotation.z) * Math.sin(elapsedMs * 0.01) * 0.08;
    setOpacity(group, alpha);
  };
  return actor;
}

function createOrbActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  anchor: Vec,
  secondary: Vec | undefined,
  width: number,
): WebGLEffectActor {
  const center = secondary ? midpoint(anchor, secondary) : anchor;
  group.position.set(center.x, center.y, 0);
  const radius = width * 0.055;

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    createMaterial(runtime.preset.palette.core, 0.86),
  );
  group.add(core);
  group.add(createDisc(radius * 2.6, runtime.preset.palette.mid, 0.2));
  group.add(createRing(radius * 1.7, runtime.preset.palette.spark, 0.72, 1.5));
  group.add(createRing(radius * 2.3, runtime.preset.palette.core, 0.46, 1));
  group.add(
    createPointsCloud(64, radius * 3.4, runtime.preset.palette.mid, 0.66, runtime.seed, 4.5),
  );

  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    const pulse = 1 + Math.sin(elapsedMs * 0.012) * 0.08;
    group.rotation.z = elapsedMs * 0.0015;
    group.scale.setScalar((0.62 + easeOut(progress) * 0.5) * pulse);
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createRushActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  direction: Vec,
  width: number,
  height: number,
): WebGLEffectActor {
  group.rotation.z = Math.atan2(direction.y, direction.x);
  const length = Math.max(width, height) * 0.78;
  const spread = height * 0.56;
  for (let i = 0; i < 34; i += 1) {
    const lane = (seeded(runtime.seed + i) - 0.5) * spread;
    const x = seeded(runtime.seed + i * 7) * width * 0.12;
    const line = createLineMesh(
      [
        { x, y: lane },
        {
          x: x + length * (0.16 + seeded(runtime.seed + i * 3) * 0.62),
          y: lane + (seeded(runtime.seed + i * 11) - 0.5) * height * 0.08,
        },
      ],
      1.4 + seeded(runtime.seed + i * 5) * 5,
      i % 5 === 0 ? runtime.preset.palette.core : runtime.preset.palette.spark,
      0.5,
    );
    group.add(line);
  }
  const actor = baseActor(runtime, group);
  actor.update = (progress) => {
    group.position.x += easeOut(progress) * 0.7;
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createColumnActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  height: number,
  width: number,
): WebGLEffectActor {
  const beam = createPlane(width * 0.16, height * 1.25, runtime.preset.palette.mid, 0.28);
  beam.position.y = height * 0.08;
  group.add(beam);
  group.add(createPlane(width * 0.055, height * 1.25, runtime.preset.palette.core, 0.36));
  group.add(createRing(width * 0.12, runtime.preset.palette.spark, 0.52, 1.4));

  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    group.scale.x = 0.72 + Math.sin(elapsedMs * 0.008) * 0.04;
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createBurstActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  width: number,
  height: number,
): WebGLEffectActor {
  group.position.y = Math.min(group.position.y + height * 0.12, height * 0.88);
  const radius = Math.min(width, height) * 0.18;
  for (let i = 0; i < 18; i += 1) {
    const angle = -Math.PI + (Math.PI * i) / 17;
    const line = createLineMesh(
      [
        { x: Math.cos(angle) * radius * 0.25, y: Math.sin(angle) * radius * 0.22 },
        {
          x: Math.cos(angle) * radius * (0.9 + seeded(runtime.seed + i) * 0.5),
          y: Math.sin(angle) * radius * 0.92,
        },
      ],
      3 + seeded(runtime.seed + i * 2) * 7,
      i % 4 === 0 ? runtime.preset.palette.spark : runtime.preset.palette.mid,
      0.56,
    );
    group.add(line);
  }
  group.add(createRing(radius, runtime.preset.palette.mid, 0.52, 1.6));

  const actor = baseActor(runtime, group);
  actor.update = (progress) => {
    group.scale.set(0.74 + progress * 0.55, 0.5 + progress * 0.34, 1);
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createBarrierActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  width: number,
): WebGLEffectActor {
  const radius = width * 0.15;
  group.add(createDisc(radius * 0.98, runtime.preset.palette.mid, 0.08));
  group.add(createRing(radius, runtime.preset.palette.mid, 0.62, 1.7));
  group.add(createRing(radius * 0.74, runtime.preset.palette.core, 0.42, 1));
  for (let i = 0; i < 8; i += 1) {
    const angle = (TAU / 8) * i;
    group.add(
      createLineMesh(
        [
          { x: Math.cos(angle) * radius * 0.2, y: Math.sin(angle) * radius * 0.24 },
          { x: Math.cos(angle) * radius * 0.92, y: Math.sin(angle) * radius * 1.08 },
        ],
        2.2,
        runtime.preset.palette.spark,
        0.5,
      ),
    );
  }
  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    group.rotation.z = Math.sin(elapsedMs * 0.002) * 0.05;
    group.scale.set(0.78 + easeOut(progress) * 0.28, 0.9 + easeOut(progress) * 0.22, 1);
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createSkyfallActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  width: number,
  height: number,
): WebGLEffectActor {
  for (let i = 0; i < 9; i += 1) {
    const beam = createPlane(
      width * (0.012 + seeded(runtime.seed + i) * 0.014),
      height * (0.24 + seeded(runtime.seed + i * 3) * 0.26),
      i % 3 === 0 ? runtime.preset.palette.core : runtime.preset.palette.mid,
      0.5,
    );
    beam.position.set(
      (seeded(runtime.seed + i * 5) - 0.5) * width * 0.46,
      -height * (0.15 + seeded(runtime.seed + i) * 0.18),
      0,
    );
    beam.rotation.z = (seeded(runtime.seed + i * 8) - 0.5) * 0.12;
    group.add(beam);
  }
  const actor = baseActor(runtime, group);
  actor.update = (progress) => {
    group.position.y += easeOut(progress) * 2.2;
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createGuardActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  width: number,
  height: number,
): WebGLEffectActor {
  group.position.y += height * 0.07;
  const radius = Math.min(width, height) * 0.22;
  group.add(createRing(radius, runtime.preset.palette.mid, 0.44, 1.2));
  group.add(
    createPointsCloud(72, radius * 1.25, runtime.preset.palette.spark, 0.54, runtime.seed, 3.5),
  );
  const actor = baseActor(runtime, group);
  actor.update = (progress, elapsedMs) => {
    group.rotation.z = Math.sin(elapsedMs * 0.004) * 0.035;
    group.scale.set(0.82 + progress * 0.24, 0.96 + progress * 0.18, 1);
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createBeamActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  direction: Vec,
  width: number,
  height: number,
): WebGLEffectActor {
  group.rotation.z = Math.atan2(direction.y, direction.x);
  const length = Math.max(width, height) * 1.08;
  const beam = createWedge(length, height * 0.06, runtime.preset.palette.mid, 0.6);
  group.add(beam);
  group.add(createWedge(length, height * 0.023, runtime.preset.palette.core, 0.78));
  group.add(
    createForwardParticles(
      24,
      length * 0.58,
      height * 0.18,
      runtime.preset.palette.core,
      0.42,
      runtime.seed,
      2.5,
    ),
  );

  const actor = baseActor(runtime, group);
  actor.update = (progress) => {
    group.scale.y = 0.62 + Math.sin(progress * Math.PI) * 0.25;
    setOpacity(group, fade(progress));
  };
  return actor;
}

function createSlashActor(
  runtime: EffectRuntime,
  group: THREE.Group,
  direction: Vec,
  width: number,
): WebGLEffectActor {
  group.rotation.z = Math.atan2(direction.y, direction.x);
  const radius = width * 0.26;
  const points = sampleArc(radius, -0.98, 1.05, 48);
  group.add(
    createRibbonMesh(points, width * 0.026, width * 0.004, runtime.preset.palette.core, 0.8),
  );
  group.add(
    createRibbonMesh(
      sampleArc(radius * 1.08, -0.86, 0.96, 42),
      width * 0.014,
      width * 0.002,
      runtime.preset.palette.spark,
      0.62,
    ),
  );
  group.add(
    createPointsOnArc(24, radius * 1.02, runtime.preset.palette.spark, 0.62, runtime.seed, 3.5),
  );

  const actor = baseActor(runtime, group);
  actor.update = (progress) => {
    group.scale.setScalar(0.72 + easeOut(progress) * 0.36);
    group.rotation.z = Math.atan2(direction.y, direction.x) + (progress - 0.5) * 0.16;
    setOpacity(group, fade(progress));
  };
  return actor;
}

function baseActor(runtime: EffectRuntime, group: THREE.Group): WebGLEffectActor {
  return {
    id: runtime.id,
    runtime,
    group,
    mode: 'transient',
    update: () => undefined,
    dispose: () => disposeGroup(group),
  };
}

// Overhaul P1 — attached hand-following aura ring. Unlike transient actors it has no
// duration/progress; the draw loop calls attachUpdate() every frame with the smoothed
// world anchor + hand openness + a fade value (0..1) for in/out.
export function createAuraRing(preset: EffectPreset, width: number): WebGLEffectActor {
  const group = new THREE.Group();
  const radius = width * 0.07;
  group.add(createRing(radius, preset.palette.mid, 0.7, Math.max(2, width * 0.0026)));
  group.add(createRing(radius * 0.62, preset.palette.core, 0.5, Math.max(1.2, width * 0.0015)));
  group.add(
    createPointsCloud(28, radius * 1.5, preset.palette.spark, 0.6, Math.random() * 1000, 3),
  );
  group.add(createGlowDisc(radius * 1.7, preset.palette.glow, 0.42));
  group.userData.brightness = 1;

  const runtime = createRuntimeEffect(preset, { x: 0.5, y: 0.5 });
  return {
    id: `aura-${runtime.id}`,
    runtime,
    group,
    mode: 'attached',
    update: () => undefined,
    attachUpdate: (world, scalar, _dir, fade, now) => {
      group.position.set(world.x, world.y, 0);
      group.rotation.z = now * 0.0014;
      group.scale.setScalar(0.7 + clamp01(scalar) * 0.5);
      setOpacity(group, fade);
    },
    dispose: () => disposeGroup(group),
  };
}

// P2 — double-palm energy orb: anchored to the midpoint between hands; closeness
// (scalar) drives scale + brightness, so cupping the hands tightens and brightens it.
export function createPalmOrb(preset: EffectPreset, width: number): WebGLEffectActor {
  const group = new THREE.Group();
  const radius = width * 0.05;
  group.add(
    new THREE.Mesh(new THREE.CircleGeometry(radius, 40), createMaterial(preset.palette.core, 0.85)),
  );
  group.add(createDisc(radius * 2.4, preset.palette.mid, 0.18));
  group.add(createRing(radius * 1.6, preset.palette.spark, 0.6, Math.max(1.2, width * 0.0016)));
  group.add(createGlowDisc(radius * 2.6, preset.palette.glow, 0.5));
  group.add(createPointsCloud(40, radius * 3, preset.palette.spark, 0.5, Math.random() * 1000, 4));
  group.userData.brightness = 1;

  const runtime = createRuntimeEffect(preset, { x: 0.5, y: 0.5 });
  return {
    id: `orb-${runtime.id}`,
    runtime,
    group,
    mode: 'attached',
    update: () => undefined,
    attachUpdate: (world, scalar, _dir, fade, now) => {
      const close = clamp01(scalar);
      group.position.set(world.x, world.y, 0);
      group.scale.setScalar(0.55 + close * 0.7);
      group.rotation.z = now * 0.0016;
      group.userData.brightness = 0.8 + close * 0.9;
      setOpacity(group, fade);
    },
    dispose: () => disposeGroup(group),
  };
}

// P2 — fingertip trail: a fixed-size ribbon following the index fingertip. Vertices live
// in world space (group at origin) so the trail stays behind as the finger moves; a fixed
// BufferGeometry is updated in place each frame (no per-frame geometry allocation).
export function createFingerTrail(preset: EffectPreset, width: number, n = 24): WebGLEffectActor {
  const group = new THREE.Group();
  const headW = width * 0.018;
  const history: Vec[] = [];
  const positions = new Float32Array(n * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const b = i * 2;
    indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);
  const material = createMaterial(preset.palette.spark, 0.75);
  group.add(new THREE.Mesh(geometry, material));
  group.userData.brightness = 1;

  const rebuild = () => {
    const m = history.length;
    for (let i = 0; i < m; i += 1) {
      const p = history[i];
      const prev = history[Math.max(0, i - 1)];
      const next = history[Math.min(m - 1, i + 1)];
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const nx = -ty;
      const ny = tx;
      const t = m <= 1 ? 0 : i / (m - 1); // 0 = oldest (thin tail), 1 = newest (wide head)
      const w = headW * t;
      const a = i * 2 * 3;
      positions[a] = p.x + nx * w;
      positions[a + 1] = p.y + ny * w;
      positions[a + 2] = 0;
      positions[a + 3] = p.x - nx * w;
      positions[a + 4] = p.y - ny * w;
      positions[a + 5] = 0;
    }
    geometry.setDrawRange(0, Math.max(0, (m - 1) * 6));
    geometry.attributes.position.needsUpdate = true;
  };

  const runtime = createRuntimeEffect(preset, { x: 0.5, y: 0.5 });
  return {
    id: `trail-${runtime.id}`,
    runtime,
    group,
    mode: 'attached',
    update: () => undefined,
    attachUpdate: (world, _scalar, _dir, fade) => {
      history.push({ x: world.x, y: world.y });
      if (history.length > n) {
        history.shift();
      }
      rebuild();
      setOpacity(group, fade);
    },
    dispose: () => disposeGroup(group),
  };
}

// P2 — body aura: a particle/ring shell around the torso, radius driven by shoulder width.
export function createBodyAura(preset: EffectPreset, width: number): WebGLEffectActor {
  const group = new THREE.Group();
  const base = width * 0.5;
  group.add(
    createPointsCloud(60, base * 0.5, preset.palette.spark, 0.5, Math.random() * 1000, 3.2),
  );
  group.add(createRing(base * 0.5, preset.palette.mid, 0.3, Math.max(1.5, width * 0.0016)));
  group.add(createGlowDisc(base * 0.7, preset.palette.glow, 0.22));
  group.userData.brightness = 1;

  const runtime = createRuntimeEffect(preset, { x: 0.5, y: 0.5 });
  return {
    id: `body-${runtime.id}`,
    runtime,
    group,
    mode: 'attached',
    update: () => undefined,
    attachUpdate: (world, scalar, _dir, fade, now) => {
      group.position.set(world.x, world.y, 0);
      group.scale.setScalar(clamp01((scalar - 0.1) / 0.3) * 0.8 + 0.6);
      group.rotation.z = Math.sin(now * 0.001) * 0.05;
      setOpacity(group, fade * 0.85);
    },
    dispose: () => disposeGroup(group),
  };
}

function createRing(radius: number, color: string, opacity: number, thickness: number): THREE.Mesh {
  const geometry = new THREE.TorusGeometry(radius, thickness, 8, 96);
  return new THREE.Mesh(geometry, createMaterial(color, opacity));
}

function createDisc(radius: number, color: string, opacity: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 64), createMaterial(color, opacity));
}

function createPlane(width: number, height: number, color: string, opacity: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), createMaterial(color, opacity));
}

function createWedge(length: number, height: number, color: string, opacity: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, -height * 0.28, 0, length, -height, 0, length, height, 0, 0, height * 0.28, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, createMaterial(color, opacity));
}

function createLineMesh(points: Vec[], width: number, color: string, opacity: number): THREE.Mesh {
  return createRibbonMesh(points, width, width * 0.55, color, opacity);
}

function createRibbonMesh(
  points: Vec[],
  startWidth: number,
  endWidth: number,
  color: string,
  opacity: number,
): THREE.Mesh {
  const vertices: number[] = [];
  const indices: number[] = [];

  points.forEach((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = normalize({ x: next.x - prev.x, y: next.y - prev.y });
    const normal = { x: -tangent.y, y: tangent.x };
    const t = points.length <= 1 ? 0 : index / (points.length - 1);
    const width = lerp(startWidth, endWidth, t) * Math.sin(Math.max(0.08, Math.PI * t));
    vertices.push(point.x + normal.x * width, point.y + normal.y * width, 0);
    vertices.push(point.x - normal.x * width, point.y - normal.y * width, 0);

    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, createMaterial(color, opacity));
}

function createPointsCloud(
  count: number,
  radius: number,
  color: string,
  opacity: number,
  seed: number,
  size: number,
): THREE.Points {
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = seeded(seed + i * 3) * TAU;
    const distance = radius * (0.24 + seeded(seed + i * 7) * 0.78);
    positions.push(Math.cos(angle) * distance, Math.sin(angle) * distance, 0);
  }
  return createPoints(positions, color, opacity, size);
}

function createForwardParticles(
  count: number,
  length: number,
  spread: number,
  color: string,
  opacity: number,
  seed: number,
  size: number,
): THREE.Points {
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    positions.push(seeded(seed + i * 2) * length, (seeded(seed + i * 5) - 0.5) * spread, 0);
  }
  return createPoints(positions, color, opacity, size);
}

function createPointsOnArc(
  count: number,
  radius: number,
  color: string,
  opacity: number,
  seed: number,
  size: number,
): THREE.Points {
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -0.9 + seeded(seed + i * 4) * 1.8;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  return createPoints(positions, color, opacity, size);
}

function createPoints(
  positions: number[],
  color: string,
  opacity: number,
  size: number,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      size: { value: size },
    },
    vertexShader: `
      uniform float size;
      void main() {
        gl_PointSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      void main() {
        float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
        float alpha = smoothstep(0.5, 0.12, distanceFromCenter) * opacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.userData.baseOpacity = opacity;
  return new THREE.Points(geometry, material);
}

function createMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  material.userData.baseOpacity = opacity;
  return material;
}

// Soft radial-falloff additive disc — an alpha-correct "glow"/bloom-substitute that
// reads as over-exposure on the transparent overlay without a post-processing pass.
function createGlowDisc(radius: number, color: string, opacity: number): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(color, a * a * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.userData.baseOpacity = opacity;
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 48), material);
}

function sampleCubic(points: Vec[], steps: number): Vec[] {
  const [a, b, c, d] = points;
  const sampled: Vec[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    sampled.push({
      x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
      y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
    });
  }
  return sampled;
}

function sampleArc(radius: number, start: number, end: number, steps: number): Vec[] {
  const sampled: Vec[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = lerp(start, end, i / steps);
    sampled.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return sampled;
}

function setOpacity(root: THREE.Object3D, alpha: number) {
  // Per-effect intensity (set in applyIntensity) scales final brightness here so weak
  // moves stay restrained and strong moves push brighter.
  const brightness = (root.userData.brightness as number | undefined) ?? 1;
  const factor = alpha * brightness;
  root.traverse((node) => {
    const object = node as THREE.Mesh | THREE.Points;
    const material = object.material;
    if (!material) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      entry.opacity = (entry.userData.baseOpacity ?? 1) * factor;
      if (entry instanceof THREE.ShaderMaterial && entry.uniforms.opacity) {
        entry.uniforms.opacity.value = (entry.userData.baseOpacity ?? 1) * factor;
      }
      entry.needsUpdate = true;
    });
  });
}

function disposeGroup(group: THREE.Group) {
  group.traverse((node) => {
    const object = node as THREE.Mesh | THREE.Points;
    object.geometry?.dispose();
    const material = object.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material?.dispose();
    }
  });
  group.clear();
}

function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalize(vector: Vec): Vec {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function fade(progress: number): number {
  return clamp01(smoothstep(0, 0.16, progress) * (1 - smoothstep(0.72, 1, progress)));
}

function easeOut(progress: number): number {
  return 1 - (1 - clamp01(progress)) ** 3;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function seeded(input: number): number {
  const value = Math.sin(input * 928.371) * 43758.5453;
  return value - Math.floor(value);
}
