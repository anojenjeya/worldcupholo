/** Client-side subject cutout — runs in the browser only. */

function hasWebGpu() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function toBlob(src: Blob | string): Promise<Blob> {
  if (typeof src !== "string") return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not load photo");
  return res.blob();
}

async function loadRgba(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { width: w, height: h, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, w, h };
}

async function resizeImageBlob(blob: Blob, w: number, h: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
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

async function rgbaToPng(data: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not encode cutout.");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Failed to encode cutout."))),
      "image/png"
    );
  });
}

type PreparedPortrait = {
  blob: Blob;
  origW: number;
  origH: number;
  targetSide: number;
  drawW: number;
  drawH: number;
  offsetX: number;
  offsetY: number;
};

function pickSegmentationModel(): "isnet_fp16" | "isnet_quint8" | "isnet" {
  if (hasWebGpu()) return "isnet_fp16";
  return "isnet_quint8";
}

function outputDimensions(origW: number, origH: number, maxSide: number) {
  const longest = Math.max(origW, origH);
  if (longest <= maxSide) return { w: origW, h: origH };
  const scale = maxSide / longest;
  return { w: Math.round(origW * scale), h: Math.round(origH * scale) };
}

/** Pad to a square canvas so the segmenter is not squashing tall subjects. */
async function padPortraitForSegmentation(
  src: Blob,
  maxSegSide = 640
): Promise<PreparedPortrait> {
  const bitmap = await createImageBitmap(src);
  const { width, height } = bitmap;
  const side = Math.max(width, height);
  const targetSide = Math.min(Math.max(side, 384), maxSegSide);
  const scale = targetSide / side;
  const drawW = Math.round(width * scale);
  const drawH = Math.round(height * scale);
  const offsetX = Math.round((targetSide - drawW) / 2);
  const offsetY = Math.round((targetSide - drawH) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = targetSide;
  canvas.height = targetSide;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, targetSide, targetSide);
  ctx.drawImage(bitmap, offsetX, offsetY, drawW, drawH);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Failed to prepare image."))),
      "image/jpeg",
      0.9
    );
  });

  return { blob, origW: width, origH: height, targetSide, drawW, drawH, offsetX, offsetY };
}

function boxBlurAlpha(alpha: Uint8Array, w: number, h: number, radius = 1): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += alpha[ny * w + nx];
            count++;
          }
        }
      }
      out[y * w + x] = Math.round(sum / count);
    }
  }
  return out;
}

function morphMin(alpha: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            min = Math.min(min, alpha[ny * w + nx]);
          }
        }
      }
      out[y * w + x] = min;
    }
  }
  return out;
}

function morphMax(alpha: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            max = Math.max(max, alpha[ny * w + nx]);
          }
        }
      }
      out[y * w + x] = max;
    }
  }
  return out;
}

/** Preserve fine alpha for hair, fur, and soft edges. */
function reshapeAlpha(a: number, gentle = false): number {
  const floor = gentle ? 10 : 14;
  const ceil = gentle ? 245 : 250;
  const gamma = gentle ? 0.88 : 0.94;
  if (a <= floor) return 0;
  if (a >= ceil) return 255;
  const t = (a - floor) / (ceil - floor);
  return Math.round(Math.pow(t, gamma) * 255);
}

function estimateBackground(
  source: Uint8ClampedArray,
  alpha: Uint8Array,
  w: number,
  h: number
): [number, number, number] {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sw = 0;

  const corners: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [w >> 1, 0],
    [w >> 1, h - 1],
    [0, h >> 1],
    [w - 1, h >> 1],
  ];

  for (const [x, y] of corners) {
    const idx = (y * w + x) * 4;
    sr += source[idx];
    sg += source[idx + 1];
    sb += source[idx + 2];
    sw += 1;
  }

  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] > 28) continue;
    const idx = i * 4;
    const weight = 1 + (28 - alpha[i]) / 28;
    sr += source[idx] * weight;
    sg += source[idx + 1] * weight;
    sb += source[idx + 2] * weight;
    sw += weight;
  }

  return [sr / sw, sg / sw, sb / sw];
}

function trimBackgroundFringe(
  alpha: Uint8Array,
  source: Uint8ClampedArray,
  bg: [number, number, number],
  gentle = false
) {
  const [br, bgg, bb] = bg;
  const distCutoff = gentle ? 48 : 64;
  const pullStrength = gentle ? 0.55 : 0.82;
  for (let i = 0; i < alpha.length; i++) {
    let a = alpha[i];
    if (a <= 0 || a >= 252) continue;
    const idx = i * 4;
    const dr = source[idx] - br;
    const dg = source[idx + 1] - bgg;
    const db = source[idx + 2] - bb;
    const dist = Math.hypot(dr, dg, db);
    if (dist < distCutoff) {
      const pull = (distCutoff - dist) / distCutoff;
      a = Math.round(a * (1 - pull * pullStrength));
    }
    alpha[i] = a;
  }
}

function decontaminate(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: [number, number, number]
): [number, number, number] {
  const af = a / 255;
  if (af <= 0.02) return [0, 0, 0];
  if (af >= 0.98) return [r, g, b];
  const [br, bgg, bb] = bg;
  const inv = 1 / Math.max(af, 0.02);
  const fr = Math.max(0, Math.min(255, (r - (1 - af) * br) * inv));
  const fg = Math.max(0, Math.min(255, (g - (1 - af) * bgg) * inv));
  const fb = Math.max(0, Math.min(255, (b - (1 - af) * bb) * inv));
  return [fr, fg, fb];
}

function measureMaskBBox(
  alpha: Uint8Array,
  w: number,
  h: number,
  threshold = 40
): { subjectW: number; subjectH: number } | null {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] >= threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { subjectW: maxX - minX + 1, subjectH: maxY - minY + 1 };
}

/** Pets and wide subjects need softer edge cleanup to keep fur and tails. */
function needsGentlePolish(alpha: Uint8Array, w: number, h: number): boolean {
  const bbox = measureMaskBBox(alpha, w, h);
  if (!bbox) return false;
  const aspect = bbox.subjectW / bbox.subjectH;
  return aspect > 1.05 || bbox.subjectH / h < 0.58;
}

function refineAlphaMask(
  rawAlpha: Uint8Array,
  w: number,
  h: number,
  gentle = false
): Uint8Array {
  const shaped = new Uint8Array(rawAlpha.length);
  for (let i = 0; i < rawAlpha.length; i++) {
    shaped[i] = reshapeAlpha(rawAlpha[i], gentle);
  }

  let refined = gentle ? shaped : morphMin(shaped, w, h, 1);
  refined = morphMax(refined, w, h, 1);
  const softened = boxBlurAlpha(refined, w, h, 1);

  const out = new Uint8Array(refined.length);
  const hardWeight = gentle ? 0.48 : 0.62;
  const softWeight = gentle ? 0.52 : 0.38;
  for (let i = 0; i < refined.length; i++) {
    const hard = refined[i];
    const soft = softened[i];
    out[i] =
      hard >= 248 ? hard : hard <= 6 ? 0 : Math.round(hard * hardWeight + soft * softWeight);
  }
  return out;
}

/** Minimal edge cleanup — skips expensive morphology passes. */
function refineAlphaMaskFast(rawAlpha: Uint8Array): Uint8Array {
  const out = new Uint8Array(rawAlpha.length);
  for (let i = 0; i < rawAlpha.length; i++) {
    out[i] = reshapeAlpha(rawAlpha[i], true);
  }
  return out;
}

function estimateBackgroundCorners(
  source: Uint8ClampedArray,
  w: number,
  h: number
): [number, number, number] {
  const points: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (const [x, y] of points) {
    const idx = (y * w + x) * 4;
    sr += source[idx];
    sg += source[idx + 1];
    sb += source[idx + 2];
  }
  return [sr / 4, sg / 4, sb / 4];
}

async function loadRgbaScaled(blob: Blob, w: number, h: number) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read image.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, w, h };
}

function cropAlpha(
  alpha: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  cw: number,
  ch: number
): Uint8Array {
  const out = new Uint8Array(cw * ch);
  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      out[row * cw + col] = alpha[(y + row) * w + (x + col)];
    }
  }
  return out;
}

function resizeAlphaBilinear(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const out = new Uint8Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = (x + 0.5) * xRatio - 0.5;
      const srcY = (y + 0.5) * yRatio - 0.5;
      const x0 = Math.max(0, Math.floor(srcX));
      const y0 = Math.max(0, Math.floor(srcY));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const xF = srcX - x0;
      const yF = srcY - y0;
      const a00 = src[y0 * srcW + x0];
      const a10 = src[y0 * srcW + x1];
      const a01 = src[y1 * srcW + x0];
      const a11 = src[y1 * srcW + x1];
      const top = a00 + (a10 - a00) * xF;
      const bot = a01 + (a11 - a01) * xF;
      out[y * dstW + x] = Math.round(top + (bot - top) * yF);
    }
  }
  return out;
}

function mapMaskToOutput(
  prepared: PreparedPortrait,
  maskBlob: Blob,
  maxSide: number
): Promise<{ alpha: Uint8Array; w: number; h: number }> {
  const { w: outW, h: outH } = outputDimensions(prepared.origW, prepared.origH, maxSide);
  return loadRgba(maskBlob).then(({ data, w, h }) => {
    const n = w * h;
    const preparedAlpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      preparedAlpha[i] = data[i * 4 + 3];
    }

    const cropped = cropAlpha(
      preparedAlpha,
      w,
      h,
      prepared.offsetX,
      prepared.offsetY,
      prepared.drawW,
      prepared.drawH
    );

    const alpha = resizeAlphaBilinear(cropped, prepared.drawW, prepared.drawH, outW, outH);
    return { alpha, w: outW, h: outH };
  });
}

function trimTransparentBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad = 10
) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { data, w, h };
  }

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const trimmed = new Uint8ClampedArray(tw * th * 4);

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * tw + x) * 4;
      trimmed[di] = data[si];
      trimmed[di + 1] = data[si + 1];
      trimmed[di + 2] = data[si + 2];
      trimmed[di + 3] = data[si + 3];
    }
  }

  return { data: trimmed, w: tw, h: th };
}

/** Fast composite at display resolution — tuned for sub-10s turnaround. */
async function polishCutoutFast(
  sourceBlob: Blob,
  alpha: Uint8Array,
  w: number,
  h: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  onProgress?.(0);
  const { data: src } = await loadRgbaScaled(sourceBlob, w, h);
  const n = w * h;

  onProgress?.(0.35);
  const refinedAlpha = refineAlphaMaskFast(alpha);
  const bg = estimateBackgroundCorners(src, w, h);

  onProgress?.(0.7);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < n; i++) {
    const a = refinedAlpha[i];
    const idx = i * 4;
    if (a <= 0) continue;

    let r = src[idx];
    let g = src[idx + 1];
    let b = src[idx + 2];

    if (a < 235) {
      [r, g, b] = decontaminate(r, g, b, a, bg);
    }

    out[idx] = Math.round(r);
    out[idx + 1] = Math.round(g);
    out[idx + 2] = Math.round(b);
    out[idx + 3] = a;
  }

  onProgress?.(1);
  return rgbaToPng(out, w, h);
}

let segmenterModule: Promise<typeof import("@imgly/background-removal")> | null = null;

/** Warm ONNX + WASM while the user is on the page. */
export function preloadBackgroundRemoval() {
  if (!segmenterModule) {
    segmenterModule = import("@imgly/background-removal");
  }
  return segmenterModule;
}

export type RemoveBgCallbacks = {
  onProgress?: (pct: number) => void;
  /** Fires with a lower-res cutout as soon as segmentation finishes. */
  onPreview?: (blob: Blob) => void;
};

function normalizeCallbacks(
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): RemoveBgCallbacks {
  if (typeof callbacks === "function") return { onProgress: callbacks };
  return callbacks ?? {};
}

const OUTPUT_MAX_SIDE = 1024;
const SEG_MAX_SIDE = 640;

export async function removePhotoBackground(
  src: Blob | string,
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): Promise<Blob> {
  const { onProgress, onPreview } = normalizeCallbacks(callbacks);
  const { segmentForeground } = await (segmenterModule ?? import("@imgly/background-removal"));

  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));
  const config = {
    model: pickSegmentationModel(),
    device: hasWebGpu() ? ("gpu" as const) : ("cpu" as const),
    proxyToWorker: true,
    output: { format: "image/png" as const, quality: 0.92 },
  };

  report(2);
  const originalBlob = await toBlob(src);
  const prepared = await padPortraitForSegmentation(originalBlob, SEG_MAX_SIDE);
  report(10);

  const mask = await segmentForeground(prepared.blob, {
    ...config,
    progress: (_key, current, total) => {
      if (total > 0) report(10 + (current / total) * 62);
    },
  });

  report(74);
  const { alpha, w, h } = await mapMaskToOutput(prepared, mask, OUTPUT_MAX_SIDE);
  report(78);

  const cutout = await polishCutoutFast(originalBlob, alpha, w, h, (p) =>
    report(78 + p * 20)
  );

  onPreview?.(cutout);
  report(100);
  return cutout;
}
