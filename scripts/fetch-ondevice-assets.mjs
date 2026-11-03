#!/usr/bin/env node
// Downloads the on-device background-removal assets into public/ondevice/ so the
// Photo studio can run fully offline (no CDN at runtime).
//
//   npm run ondevice:assets
//
// Then add these to .env:
//   VITE_ONDEVICE_WASM_URL=/ondevice/wasm
//   VITE_ONDEVICE_SEGMENTER_URL=/ondevice/models/selfie_segmenter.tflite
//   VITE_ONDEVICE_IMGLY_PATH=/ondevice/imgly/
//
// The folder is intentionally git-ignored (it is ~80 MB of model data).

import { mkdir, readFile, writeFile, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'public', 'ondevice');

const IMGLY_VERSION = '1.7.0';
const IMGLY_BASE = `https://staticimgly.com/@imgly/background-removal-data/${IMGLY_VERSION}/dist/`;
const MEDIAPIPE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

// Only the model + runtime we actually use, not every model variant.
const IMGLY_KEYS = [
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
  '/models/isnet_quint8',
];

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return buffer.length;
}

async function copyMediaPipeWasm() {
  const src = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  const dest = path.join(outRoot, 'wasm');
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  let total = 0;
  for (const file of files) {
    const from = path.join(src, file);
    const info = await stat(from);
    if (!info.isFile()) continue;
    await copyFile(from, path.join(dest, file));
    total += info.size;
  }
  console.log(`  mediapipe wasm → public/ondevice/wasm (${mb(total)})`);
}

async function fetchMediaPipeModel() {
  const dest = path.join(outRoot, 'models', 'selfie_segmenter.tflite');
  const size = await download(MEDIAPIPE_MODEL, dest);
  console.log(`  selfie_segmenter.tflite → public/ondevice/models (${mb(size)})`);
}

async function fetchImgly() {
  const dest = path.join(outRoot, 'imgly');
  await mkdir(dest, { recursive: true });

  console.log('  fetching imgly resources.json…');
  const res = await fetch(`${IMGLY_BASE}resources.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for imgly resources.json`);
  const all = await res.json();

  const filtered = {};
  const chunkNames = new Set();
  for (const key of IMGLY_KEYS) {
    const entry = all[key];
    if (!entry) throw new Error(`imgly resources.json has no entry for ${key}`);
    filtered[key] = entry;
    for (const chunk of entry.chunks) chunkNames.add(chunk.name);
  }

  let total = 0;
  let index = 0;
  for (const name of chunkNames) {
    index += 1;
    process.stdout.write(`\r  imgly chunk ${index}/${chunkNames.size}…`);
    total += await download(`${IMGLY_BASE}${name}`, path.join(dest, name));
  }
  process.stdout.write('\r');

  await writeFile(path.join(dest, 'resources.json'), JSON.stringify(filtered, null, 2));
  console.log(`  imgly assets → public/ondevice/imgly (${mb(total)})`);
}

async function main() {
  console.log('Fetching on-device background-removal assets…\n');
  await copyMediaPipeWasm();
  await fetchMediaPipeModel();
  await fetchImgly();
  console.log(`
Done. Add these to .env and restart the dev server:

  VITE_ONDEVICE_WASM_URL=/ondevice/wasm
  VITE_ONDEVICE_SEGMENTER_URL=/ondevice/models/selfie_segmenter.tflite
  VITE_ONDEVICE_IMGLY_PATH=/ondevice/imgly/
`);
}

main().catch((err) => {
  console.error('\nFailed:', err?.message || err);
  process.exitCode = 1;
});
