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

/** Smaller quantised model — faster first-visit download and inference. */
function pickModel(): "isnet_quint8" {
  return "isnet_quint8";
}

/** Segmentation resolution — lower = faster; card display is ~336px wide. */
const SEGMENT_MAX_SIDE = 448;

/** Dim background pixels when the scene is mostly environment. */
const BACKGROUND_OPACITY = 0.62;

/** Foreground pixel share at or below this → keep background (50%+ is background). */
const BACKGROUND_DOMINANT_THRESHOLD = 0.5;

function buildConfig(onProgress?: (pct: number) => void): Config {
  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));
  return {
    model: pickModel(),
    device: hasWebGpu() ? "gpu" : "cpu",
    proxyToWorker: true,
    rescale: true,
    output: { format: "image/png", quality: 0.85 },
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
  const stride = 2;

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      if (data[(y * w + x) * 4 + 3] <= 12) continue;
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
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Failed to resize image."))),
      "image/jpeg",
      0.9
    );
  });
}

let preloadPromise: Promise<void> | null = null;

/** Download ONNX weights while the user is on the page (not just the JS bundle). */
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
  /** False for scenic / background-heavy shots — show the full photo on the card. */
  cutout: boolean;
  /** Background pixels were dimmed instead of removed. */
  softBackground?: boolean;
};

export type RemoveBgCallbacks = {
  onProgress?: (pct: number) => void;
  onPreview?: (result: PhotoProcessResult) => void;
};

/** Share of mask pixels classified as foreground (sampled for speed). */
async function measureForegroundRatio(
  maskBlob: Blob,
  threshold = 40,
  stride = 4
): Promise<number> {
  const bitmap = await createImageBitmap(maskBlob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return 1;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  let foreground = 0;
  let samples = 0;

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      samples++;
      if (data[(y * w + x) * 4 + 3] >= threshold) foreground++;
    }
  }

  return samples > 0 ? foreground / samples : 1;
}

/** Keep the scene but dim background pixels so the subject still reads on the card. */
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
      0.9
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
  report(72);

  const foregroundRatio = await measureForegroundRatio(mask);
  if (foregroundRatio <= BACKGROUND_DOMINANT_THRESHOLD) {
    const blob = await compositeSoftBackground(work, mask);
    const kept: PhotoProcessResult = { blob, cutout: false, softBackground: true };
    onPreview?.(kept);
    report(100);
    return kept;
  }

  const raw = await applySegmentationMask(work, mask, config);
  report(88);
  const cutoutBlob = await trimTransparentCutout(raw);
  const result: PhotoProcessResult = { blob: cutoutBlob, cutout: true };

  onPreview?.(result);
  report(100);
  return result;
}
