# AuraSeal VFX Architecture

AuraSeal no longer uses a per-frame Canvas 2D painter for effects. The MVP now keeps MediaPipe as the local browser recognition layer and moves visual effects into a transparent Three.js/WebGL layer.

## Why This Replaced Canvas 2D

The old renderer rebuilt many Bezier curves, gradients, shadows, and full-screen overlays every animation frame. That approach is fragile for a webcam app because CPU rendering, model inference, and React state updates compete in the same frame budget.

The new split is:

- `src/vision`: MediaPipe hand and pose detection, throttled to a fixed recognition cadence.
- `src/effects/webglRenderer.ts`: GPU-backed VFX actors made from mesh ribbons, rings, wedges, and point particles.
- `src/ui/EffectCanvas.tsx`: WebGL scene lifecycle, actor pooling, resizing, and rendering.

## Open-Source References

The useful pattern from similar open-source work is not a direct code copy. It is the architecture: camera/landmark input drives a WebGL scene, and the effect system keeps persistent GPU objects instead of repainting complex 2D paths every frame.

References checked:

- `tensorflow/tfjs-models` pose-detection: browser pose model examples and webcam inference shape.
  https://github.com/tensorflow/tfjs-models/tree/master/pose-detection
- `CodeGoura/ParticleSystem`: real-time 3D particles controlled by hand tracking with Three.js and MediaPipe.
  https://github.com/CodeGoura/ParticleSystem
- `kosa-tech/hand-tracking-particles`: MediaPipe hand tracking driving a Three.js particle simulation.
  https://github.com/kosa-tech/hand-tracking-particles
- `ossamamehmood/holoflux-gesture-engine`: a gesture-driven Three.js/MediaPipe particle engine with GLSL/WebGL direction.
  https://github.com/ossamamehmood/holoflux-gesture-engine

## Performance Rules

- Do not add new per-frame Canvas 2D effects.
- Keep recognition and rendering loops separate.
- Recognition should run below display refresh rate unless a specific detector requires otherwise.
- Create effect geometry once per trigger, then animate transforms and material opacity.
- Dispose geometries and materials when an effect ends.
- Prefer a small number of strong mesh ribbons and point clouds over thousands of CPU-updated particles.

## Next Upgrade Path

If bundle size or GPU capability becomes a blocker, the next candidates are:

- lazy-loading the WebGL renderer after camera permission,
- moving from Three.js to OGL or hand-written WebGL for a smaller runtime,
- shader-driven particles for high-count effects,
- segmentation/depth masking so effects can pass behind the body.
