// services/onDeviceBackgroundRemoval.ts
//
// Background removal that runs entirely on the user's device.
//
// Two engines:
//   • fast    – MediaPipe Selfie Segmenter (WASM, ~250 KB model). Great for
//               people/portraits and instant on phones.
//   • quality – @imgly/background-removal (ONNX Runtime Web / WebGPU). Works on
//               any subject; the first run downloads a ~40 MB quantised model,
//               then the browser caches it and later runs are offline.
//
// Nothing is uploaded. Assets (WASM + models) are fetched once and cached by the
// browser. Set VITE_ONDEVICE_* env vars (see below) to serve them from your own
// origin for a fully offline deployment.

export type BgEngine = 'auto' | 'fast' | 'quality';
export type BgStage = 'loading' | 'segmenting' | 'composing' | 'done';

export interface BgProgress {
  stage: BgStage;
  message: string;
  /** 0-100 when the step reports measurable progress (model download). */
  percent?: number;
}

export interface BgResult {
  blob: Blob;
  engine: 'fast' | 'quality';
  /** Fraction of the image kept (0-1). Used to decide when to auto-escalate. */
  coverage: number;
  /** Fraction of pixels the fast model is highly confident are foreground. */
  strongForeground: number;
  /** Wall-clock time for the whole operation, in ms. */
  ms: number;
}

// --- Asset locations -------------------------------------------------------
// Defaults point at public CDNs so the feature works with zero setup. Override
// these to self-host for offline/air-gapped use:
//   VITE_ONDEVICE_WASM_URL        e.g. /ondevice/wasm
//   VITE_ONDEVICE_SEGMENTER_URL   e.g. /ondevice/models/selfie_segmenter.tflite
//   VITE_ONDEVICE_IMGLY_PATH      e.g. /ondevice/imgly/
const env = (name: string): string => {
  try {
    return String((import.meta as any).env?.[name] || '').trim();
  } catch {
    return '';
  }
};

const MEDIAPIPE_VERSION = '1.2.0';

const ASSETS = {
  wasm: env('VITE_ONDEVICE_WASM_URL') ||
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  segmenterModel: env('VITE_ONDEVICE_SEGMENTER_URL') ||
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  imglyPublicPath: env('VITE_ONDEVICE_IMGLY_PATH') || undefined,
};

/** True when both engines would need a network fetch the first time. */
export const ON_DEVICE_ASSETS_ARE_REMOTE =
  /^https?:/i.test(ASSETS.wasm) || /^https?:/i.test(ASSETS.segmenterModel);

const MAX_DEVICE_DIM = 4096;

// --- Small helpers ---------------------------------------------------------

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // Safari fallback
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode this image.'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bitmapSize(bitmap: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return {
    width: 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width,
    height: 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height,
  };
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the cutout.'))),
      type,
      0.95,
    );
  });
}

/** Average alpha of a cutout, sampled on a small canvas. */
async function measureCoverage(blob: Blob): Promise<number> {
  try {
    const bitmap = await loadBitmap(blob);
    const { width, height } = bitmapSize(bitmap);
    const size = 64;
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0.5;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    const coverage = sum / (size * size * 255);
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    return clamp01(coverage);
  } catch {
    return 0.5;
  }
}

// --- Fast engine: MediaPipe Selfie Segmenter -------------------------------

type Segmenter = {
  segment: (image: ImageBitmap | HTMLImageElement) => any;
  close?: () => void;
};

let fastSegmenterPromise: Promise<Segmenter> | null = null;

async function createFastSegmenter(): Promise<Segmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(ASSETS.wasm);

  const create = (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: ASSETS.segmenterModel, delegate },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });

  try {
    return (await create('GPU')) as unknown as Segmenter;
  } catch (err) {
    console.warn('[bg] GPU delegate unavailable, using CPU', err);
    return (await create('CPU')) as unknown as Segmenter;
  }
}

function getFastSegmenter(): Promise<Segmenter> {
  if (!fastSegmenterPromise) {
    fastSegmenterPromise = createFastSegmenter().catch((err) => {
      fastSegmenterPromise = null; // allow a retry on the next attempt
      throw err;
    });
  }
  return fastSegmenterPromise;
}

/** Warm up the fast model without removing a background (used for preload). */
export async function preloadFastEngine(): Promise<void> {
  await getFastSegmenter();
}

async function removeFast(file: File, onProgress?: (p: BgProgress) => void): Promise<BgResult> {
  const started = performance.now();
  onProgress?.({ stage: 'loading', message: 'Loading the on-device model…' });

  const bitmap = await loadBitmap(file);
  const { width: srcW, height: srcH } = bitmapSize(bitmap);
  const scale = Math.min(1, MAX_DEVICE_DIM / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const segmenter = await getFastSegmenter();
  onProgress?.({ stage: 'segmenting', message: 'Finding the subject…' });

  const raw = segmenter.segment(bitmap);
  const result: any = raw && typeof raw.then === 'function' ? await raw : raw;
  const mask = result?.confidenceMasks?.[0];
  if (!mask) {
    result?.close?.();
    throw new Error('The on-device model did not find a subject.');
  }

  onProgress?.({ stage: 'composing', message: 'Cutting out the subject…' });

  const maskW = mask.width;
  const maskH = mask.height;
  const confidence: Float32Array = mask.getAsFloat32Array();

  // Soft matte: a mild curve keeps hair/edges soft but removes low-confidence haze.
  const maskCanvas = makeCanvas(maskW, maskH);
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) throw new Error('Canvas is not available in this browser.');
  const maskImage = maskCtx.createImageData(maskW, maskH);
  let coverageSum = 0;
  let strongForegroundPixels = 0;
  for (let i = 0; i < maskW * maskH; i += 1) {
    const rawConfidence = confidence[i];
    const v = clamp01((rawConfidence - 0.06) / 0.9);
    coverageSum += v;
    if (rawConfidence > 0.85) strongForegroundPixels += 1;
    const offset = i * 4;
    maskImage.data[offset] = 255;
    maskImage.data[offset + 1] = 255;
    maskImage.data[offset + 2] = 255;
    maskImage.data[offset + 3] = Math.round(v * 255);
  }
  maskCtx.putImageData(maskImage, 0, 0);
  const coverage = clamp01(coverageSum / (maskW * maskH));
  const strongForeground = clamp01(strongForegroundPixels / (maskW * maskH));

  // Upscale the matte with smoothing, then use it as the alpha channel.
  const scaledMask = makeCanvas(width, height);
  const scaledCtx = scaledMask.getContext('2d');
  if (!scaledCtx) throw new Error('Canvas is not available in this browser.');
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(maskCanvas, 0, 0, width, height);

  const output = makeCanvas(width, height);
  const outCtx = output.getContext('2d');
  if (!outCtx) throw new Error('Canvas is not available in this browser.');
  outCtx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  outCtx.globalCompositeOperation = 'destination-in';
  outCtx.drawImage(scaledMask, 0, 0);
  outCtx.globalCompositeOperation = 'source-over';

  // Release native resources.
  result?.close?.();
  mask.close?.();
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  onProgress?.({ stage: 'composing', message: 'Encoding PNG…' });
  const blob = await canvasToBlob(output);

  return { blob, engine: 'fast', coverage, strongForeground, ms: Math.round(performance.now() - started) };
}

// --- Quality engine: @imgly/background-removal -----------------------------

function prettyAssetName(key: string): string {
  if (/model/i.test(key)) return 'cutout model';
  if (/wasm/i.test(key)) return 'inference engine';
  return 'model data';
}

async function removeQuality(file: File, onProgress?: (p: BgProgress) => void): Promise<BgResult> {
  const started = performance.now();
  onProgress?.({ stage: 'loading', message: 'Preparing the high-quality model…' });

  const { removeBackground } = await import('@imgly/background-removal');

  const run = (device: 'gpu' | 'cpu') =>
    removeBackground(file, {
      device,
      model: 'isnet_quint8', // ~40 MB, cached after the first run
      output: { format: 'image/png', quality: 1 },
      ...(ASSETS.imglyPublicPath ? { publicPath: ASSETS.imglyPublicPath } : {}),
      progress: (key: string, current: number, total: number) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : undefined;
        onProgress?.({
          stage: 'loading',
          message: `Downloading ${prettyAssetName(key)}…`,
          percent,
        });
      },
    });

  let blob: Blob;
  try {
    blob = await run('gpu');
  } catch (err) {
    console.warn('[bg] WebGPU path failed, retrying on CPU', err);
    onProgress?.({ stage: 'loading', message: 'Retrying on CPU…' });
    blob = await run('cpu');
  }

  onProgress?.({ stage: 'composing', message: 'Measuring the cutout…' });
  const coverage = await measureCoverage(blob);

  return { blob, engine: 'quality', coverage, strongForeground: coverage, ms: Math.round(performance.now() - started) };
}

// --- Public entry point ----------------------------------------------------

/**
 * Remove the background locally. `auto` starts with the fast selfie model and
 * escalates to the high-quality model when the fast model clearly missed the
 * subject (e.g. products, pets, or a photo with no person).
 */
export async function removeBackgroundOnDevice(
  file: File,
  engine: BgEngine = 'auto',
  onProgress?: (p: BgProgress) => void,
): Promise<BgResult> {
  if (engine === 'quality') {
    return removeQuality(file, onProgress);
  }

  const fast = await removeFast(file, onProgress);
  if (engine === 'fast') return fast;

  // Auto: a selfie model with almost no confident foreground (or a mask that
  // keeps nearly the whole frame) probably did not understand the subject.
  // Escalate once to the general-purpose model.
  const missed = fast.strongForeground < 0.005 || fast.coverage > 0.995;
  if (!missed) return fast;

  onProgress?.({
    stage: 'loading',
    message: 'Subject unclear — trying the high-quality model…',
  });
  try {
    return await removeQuality(file, onProgress);
  } catch (err) {
    console.warn('[bg] high-quality escalation failed, keeping fast result', err);
    return fast;
  }
}
