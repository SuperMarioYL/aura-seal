import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Overhaul P5 — a lens-style screen pass for cinema mode: subtle chromatic aberration
// (RGB split toward the edges) + a soft vignette, for "番剧镜头" feel. Runs only inside
// the opt-in cinema composer, after bloom.
export function createScreenFxPass(): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uChroma: { value: 0.0022 },
      uVignette: { value: 0.55 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uChroma;
      uniform float uVignette;
      varying vec2 vUv;
      void main() {
        vec2 dir = vUv - 0.5;
        float amt = uChroma * dot(dir, dir) * 4.0;
        float r = texture2D(tDiffuse, vUv + dir * amt).r;
        vec4 base = texture2D(tDiffuse, vUv);
        float b = texture2D(tDiffuse, vUv - dir * amt).b;
        vec3 col = vec3(r, base.g, b);
        float vig = 1.0 - uVignette * dot(dir, dir);
        gl_FragColor = vec4(col * vig, base.a);
      }
    `,
  });
}
