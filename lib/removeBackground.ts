/** Client-side subject cutout — runs in the browser only. */

import type { Config } from "@imgly/background-removal";

function hasWebGpu() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function importBgRemoval() {
  return import("@imgly/background-removal");
}

async function toBlob(src: Blob | string): Promise<Blob> {
  if (typeof src !== "string") return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not load photo");
  return res.blob();
}

function pickModel(): "isnet_fp16" | "isnet_quint8" {
  return hasWebGpu() ? "isnet_fp16" : "isnet_quint8";
}

/** Segmentation resolution — 640px matches model rescale sweet spot. */
const SEGMENT_MAX_SIDE = 640;

const BACKGROUND_OPACITY = 0.62;
const BACKGROUND_DOMINANT_THRESHOLD = 0.5;

function buildConfig(onProgress?: (pct: number) => void): Config {
  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));
  return {
    model: pickModel(),
    device: hasWebGpu() ? "gpu" : "cpu",
    proxyToWorker: true,
    rescale: true,
    output: { format: "image/png", quality: 0.92 },
    progress: (key, current, total) => {
      if (total <= 0) return;
      const ratio = current / total;
      if (key.startsWith("fetch:")) {
        report(4 + ratio * 24);
      } else if (key.startsWith("compute:")) {
        report(30 + ratio * 48);
      }
    },
  };
}

async function loadMaskPixels(maskBlob: Blob) {
  const bitmap = await createImageBitmap(maskBlob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read mask.");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { data: ctx.getImageData(0, 0, w, h), w, h, canvas, ctx };
}

async function maskPixelsToBlob(
  data: ImageData,
  w: number,
  h: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Blob> {
  ctx.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode mask."))),
      "image/png"
    );
  });
}

/**
 * Keep only the foreground island connected to the subject (lower-center seed).
 * Removes stray mask speckles above the head / in the background.
 */
function keepSubjectMaskComponent(
  data: ImageData,
  w: number,
  h: number,
  threshold = 52
): void {
  const px = data.data;
  const visited = new Uint8Array(w * h);
  const keep = new Uint8Array(w * h);

  let seedX = Math.floor(w * 0.5);
  let seedY = Math.floor(h * 0.72);
  let seedIdx = seedY * w + seedX;

  if (px[seedIdx * 4 + 3] < threshold) {
    let found = false;
    for (let r = 1; r <= Math.max(w, h) && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = seedX + dx;
          const y = seedY + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (px[i * 4 + 3] >= threshold) {
            seedX = x;
            seedY = y;
            seedIdx = i;
            found = true;
            break;
          }
        }
      }
    }
    if (!found) return;
  }

  const queue = [seedIdx];
  visited[seedIdx] = 1;
  keep[seedIdx] = 1;

  while (queue.length > 0) {
    const i = queue.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const ni of neighbors) {
      if (ni < 0 || visited[ni]) continue;
      visited[ni] = 1;
      if (px[ni * 4 + 3] < threshold) continue;
      keep[ni] = 1;
      queue.push(ni);
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) px[i * 4 + 3] = 0;
  }
}

/** Soften mask edges and harden core/background for a cleaner cutout. */
function polishMaskAlpha(data: ImageData, w: number, h: number): void {
  const px = data.data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = px[i * 4 + 3];

  const blurred = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += alpha[ny * w + nx];
          n++;
        }
      }
      blurred[y * w + x] = Math.round(sum / n);
    }
  }

  for (let i = 0; i < w * h; i++) {
    let a = blurred[i];
    if (a < 24) a = 0;
    else if (a > 232) a = 255;
    px[i * 4 + 3] = a;
  }
}

async function refineCutoutMask(maskBlob: Blob): Promise<Blob> {
  const { data, w, h, canvas, ctx } = await loadMaskPixels(maskBlob);
  keepSubjectMaskComponent(data, w, h);
  polishMaskAlpha(data, w, h);
  return maskPixelsToBlob(data, w, h, canvas, ctx);
}

/** Reduce colored halos on semi-transparent edge pixels (common on red/busy backgrounds). */
async function defringeCutout(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const a = px[idx + 3];
    if (a <= 14) {
      px[idx + 3] = 0;
      continue;
    }
    if (a >= 250) continue;

    const r = px[idx];
    const g = px[idx + 1];
    const b = px[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const spill = Math.max(0, r - Math.max(g, b), g - Math.max(r, b));
    const edge = 1 - a / 255;

    if (spill > 18 && edge > 0.08) {
      const mix = Math.min(0.72, edge * 0.9);
      px[idx] = Math.round(r * (1 - mix) + lum * mix);
      px[idx + 1] = Math.round(g * (1 - mix) + lum * mix);
      px[idx + 2] = Math.round(b * (1 - mix) + lum * mix);
    }

    if (a < 28) px[idx + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to defringe cutout."))),
      "image/png"
    );
  });
}

async function trimTransparentCutout(blob: Blob, pad = 10): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return blob;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const outCtx = out.getContext("2d");
  if (!outCtx) return blob;
  outCtx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

  return new Promise((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to trim cutout."))),
      "image/png"
    );
  });
}

async function resizeToMaxSide(blob: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    bitmap.close();
    return blob;
  }

  const scale = maxSide / longest;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not resize image.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Failed to resize image."))),
      "image/png"
    );
  });
}

let preloadPromise: Promise<void> | null = null;

export function preloadBackgroundRemoval() {
  if (!preloadPromise) {
    preloadPromise = importBgRemoval()
      .then(({ preload }) => preload(buildConfig()))
      .catch(() => {
        preloadPromise = null;
      });
  }
  return preloadPromise;
}

export type PhotoProcessResult = {
  blob: Blob;
  cutout: boolean;
  softBackground?: boolean;
};

export type RemoveBgCallbacks = {
  onProgress?: (pct: number) => void;
  onPreview?: (result: PhotoProcessResult) => void;
};

async function measureForegroundRatio(
  maskBlob: Blob,
  threshold = 40,
  stride = 4
): Promise<number> {
  const { data, w, h } = await loadMaskPixels(maskBlob);
  const px = data.data;
  let foreground = 0;
  let samples = 0;

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      samples++;
      if (px[(y * w + x) * 4 + 3] >= threshold) foreground++;
    }
  }

  return samples > 0 ? foreground / samples : 1;
}

async function compositeSoftBackground(
  image: Blob,
  mask: Blob,
  bgOpacity = BACKGROUND_OPACITY,
  fgThreshold = 48
): Promise<Blob> {
  const [imgBitmap, maskBitmap] = await Promise.all([
    createImageBitmap(image),
    createImageBitmap(mask),
  ]);
  const w = imgBitmap.width;
  const h = imgBitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    imgBitmap.close();
    maskBitmap.close();
    return image;
  }

  ctx.drawImage(imgBitmap, 0, 0);
  imgBitmap.close();

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) {
    maskBitmap.close();
    return image;
  }
  maskCtx.drawImage(maskBitmap, 0, 0, w, h);
  maskBitmap.close();

  const imgData = ctx.getImageData(0, 0, w, h);
  const maskData = maskCtx.getImageData(0, 0, w, h);
  const pixels = imgData.data;
  const maskPixels = maskData.data;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    if (maskPixels[idx + 3] >= fgThreshold) continue;
    pixels[idx] = Math.round(pixels[idx] * bgOpacity);
    pixels[idx + 1] = Math.round(pixels[idx + 1] * bgOpacity);
    pixels[idx + 2] = Math.round(pixels[idx + 2] * bgOpacity);
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to composite scenic photo."))),
      "image/jpeg",
      0.92
    );
  });
}

function normalizeCallbacks(
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): RemoveBgCallbacks {
  if (typeof callbacks === "function") return { onProgress: callbacks };
  return callbacks ?? {};
}

export async function removePhotoBackground(
  src: Blob | string,
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): Promise<PhotoProcessResult> {
  const { onProgress, onPreview } = normalizeCallbacks(callbacks);
  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));

  const importTask = importBgRemoval();
  const preloadTask = preloadBackgroundRemoval().catch(() => undefined);

  report(2);
  const original = await toBlob(src);
  report(6);
  const work = await resizeToMaxSide(original, SEGMENT_MAX_SIDE);
  report(10);

  const [{ segmentForeground, applySegmentationMask }] = await Promise.all([
    importTask,
    preloadTask,
  ]);
  const config = buildConfig(onProgress);

  const mask = await segmentForeground(work, config);
  report(70);

  const foregroundRatio = await measureForegroundRatio(mask);
  if (foregroundRatio <= BACKGROUND_DOMINANT_THRESHOLD) {
    const blob = await compositeSoftBackground(work, mask);
    const kept: PhotoProcessResult = { blob, cutout: false, softBackground: true };
    onPreview?.(kept);
    report(100);
    return kept;
  }

  const refinedMask = await refineCutoutMask(mask);
  report(78);
  const raw = await applySegmentationMask(work, refinedMask, config);
  report(86);
  const defringed = await defringeCutout(raw);
  report(92);
  const cutoutBlob = await trimTransparentCutout(defringed);
  const result: PhotoProcessResult = { blob: cutoutBlob, cutout: true };

  onPreview?.(result);
  report(100);
  return result;
}
