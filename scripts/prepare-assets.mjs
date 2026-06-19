// Same-origin self-hosting of MediaPipe runtime so the app never reaches out to a
// third-party CDN (googleapis / jsdeljvr) at runtime. This is what makes the
// "本地推理零上传" privacy story verifiable: with these assets served from our own
// origin, the network panel shows no third-party model/WASM requests.
//
// - WASM is copied from the already-installed @mediapipe/tasks-vision package (no network).
// - The two .task models are downloaded once into public/mediapipe/models (cached after).
//
// Runs automatically via `predev` / `prebuild`. Idempotent: skips work already done.
import { createWriteStream } from 'node:fs';
import { cp, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = resolve(root, 'public/mediapipe/wasm');
const modelsDir = resolve(root, 'public/mediapipe/models');

const MODELS = [
  {
    file: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
  {
    file: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(wasmSrc))) {
    throw new Error(`MediaPipe WASM not found at ${wasmSrc}. Run \`npm install\` first.`);
  }
  await mkdir(wasmDst, { recursive: true });
  await cp(wasmSrc, wasmDst, { recursive: true });
  console.log(`[prepare-assets] WASM copied -> public/mediapipe/wasm`);
}

async function download({ file, url }) {
  const dst = resolve(modelsDir, file);
  if (await exists(dst)) {
    console.log(`[prepare-assets] model cached: ${file}`);
    return;
  }
  await mkdir(modelsDir, { recursive: true });
  console.log(`[prepare-assets] downloading ${file} ...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${file}: HTTP ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dst));
  console.log(`[prepare-assets] saved model: ${file}`);
}

async function main() {
  await copyWasm();
  for (const model of MODELS) {
    await download(model);
  }
  console.log('[prepare-assets] done.');
}

main().catch((err) => {
  console.error('[prepare-assets] FAILED:', err.message);
  process.exitCode = 1;
});
