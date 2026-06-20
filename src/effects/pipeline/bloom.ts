import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createScreenFxPass } from './screenFx';

// Overhaul P3 — real post-processing bloom for "影院模式" (cinema mode). Runs on the
// transparent effects scene only (the camera feed stays a CSS layer behind), so bright
// effect cores actually bleed glow outward. High threshold = only the hot cores bloom.
// Opt-in + fallback at the call site: any failure here degrades to direct rendering.
export interface BloomPipeline {
  render: () => void;
  setSize: (w: number, h: number) => void;
  dispose: () => void;
}

export function createBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  strength = 0.9,
): BloomPipeline {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0; // keep the overlay transparent so the camera shows through
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), strength, 0.4, 0.82);
  composer.addPass(bloom);
  composer.addPass(createScreenFxPass());
  composer.addPass(new OutputPass());

  return {
    render: () => composer.render(),
    setSize: (w: number, h: number) => {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    dispose: () => composer.dispose(),
  };
}
