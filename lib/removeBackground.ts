/** Client-side portrait cutout — runs in the browser only. */

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

/** Pad to a square canvas so the segmenter is not squashing tall portraits. */
async function padPortraitForSegmentation(src: Blob): Promise<PreparedPortrait> {
  const bitmap = await createImageBitmap(src);
  const { width, height } = bitmap;
  const side = Math.max(width, height);
  const targetSide = Math.min(Math.max(side, 1280), 2048);
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
      "image/png"
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

/** Preserve fine alpha for hair and soft edges. */
function reshapeAlpha(a: number): number {
  if (a <= 14) return 0;
  if (a >= 250) return 255;
  const t = (a - 14) / (250 - 14);
  return Math.round(Math.pow(t, 0.94) * 255);
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
  bg: [number, number, number]
) {
  const [br, bgg, bb] = bg;
  for (let i = 0; i < alpha.length; i++) {
    let a = alpha[i];
    if (a <= 0 || a >= 252) continue;
    const idx = i * 4;
    const dr = source[idx] - br;
    const dg = source[idx + 1] - bgg;
    const db = source[idx + 2] - bb;
    const dist = Math.hypot(dr, dg, db);
    if (dist < 64) {
      const pull = (64 - dist) / 64;
      a = Math.round(a * (1 - pull * 0.82));
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

function refineAlphaMask(rawAlpha: Uint8Array, w: number, h: number): Uint8Array {
  const shaped = new Uint8Array(rawAlpha.length);
  for (let i = 0; i < rawAlpha.length; i++) {
    shaped[i] = reshapeAlpha(rawAlpha[i]);
  }

  // Light erosion only — heavy morphMin was eating hair wisps.
  let refined = morphMin(shaped, w, h, 1);
  refined = morphMax(refined, w, h, 1);
  const softened = boxBlurAlpha(refined, w, h, 1);

  const out = new Uint8Array(refined.length);
  for (let i = 0; i < refined.length; i++) {
    const hard = refined[i];
    const soft = softened[i];
    out[i] =
      hard >= 248 ? hard : hard <= 6 ? 0 : Math.round(hard * 0.62 + soft * 0.38);
  }
  return out;
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

function mapMaskToOriginal(prepared: PreparedPortrait, maskBlob: Blob): Promise<Uint8Array> {
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

    return resizeAlphaBilinear(
      cropped,
      prepared.drawW,
      prepared.drawH,
      prepared.origW,
      prepared.origH
    );
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

/** Composite original full-res colors with a refined matte and remove background spill. */
async function polishCutout(
  sourceBlob: Blob,
  alpha: Uint8Array,
  w: number,
  h: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  onProgress?.(0);
  const source = await loadRgba(sourceBlob);
  if (source.w !== w || source.h !== h) {
    throw new Error("Cutout mask size mismatch.");
  }

  const { data: src } = source;
  const n = w * h;

  onProgress?.(0.2);
  let refinedAlpha = refineAlphaMask(alpha, w, h);
  const bg = estimateBackground(src, refinedAlpha, w, h);

  onProgress?.(0.45);
  trimBackgroundFringe(refinedAlpha, src, bg);

  onProgress?.(0.7);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < n; i++) {
    let a = refinedAlpha[i];
    const idx = i * 4;
    if (a <= 0) continue;

    let r = src[idx];
    let g = src[idx + 1];
    let b = src[idx + 2];

    if (a < 252) {
      [r, g, b] = decontaminate(r, g, b, a, bg);
    }

    out[idx] = Math.round(r);
    out[idx + 1] = Math.round(g);
    out[idx + 2] = Math.round(b);
    out[idx + 3] = a;
  }

  // Remove only obvious background halos — keep semi-transparent hair.
  for (let i = 0; i < n; i++) {
    const a = out[i * 4 + 3];
    if (a <= 0 || a >= 160) continue;
    const idx = i * 4;
    const dr = out[idx] - bg[0];
    const dg = out[idx + 1] - bg[1];
    const db = out[idx + 2] - bg[2];
    if (Math.hypot(dr, dg, db) < 28) {
      out[idx + 3] = 0;
    }
  }

  onProgress?.(0.85);
  const trimmed = trimTransparentBounds(out, w, h, 10);

  onProgress?.(1);
  return rgbaToPng(trimmed.data, trimmed.w, trimmed.h);
}

export async function removePhotoBackground(
  src: Blob | string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const { segmentForeground } = await import("@imgly/background-removal");

  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));
  const config = {
    model: "isnet" as const,
    device: hasWebGpu() ? ("gpu" as const) : ("cpu" as const),
    proxyToWorker: true,
    output: { format: "image/png" as const, quality: 1 },
  };

  report(2);
  const originalBlob = await toBlob(src);
  const prepared = await padPortraitForSegmentation(originalBlob);
  report(10);

  const mask = await segmentForeground(prepared.blob, {
    ...config,
    progress: (_key, current, total) => {
      if (total > 0) report(10 + (current / total) * 55);
    },
  });

  report(68);
  const fullResAlpha = await mapMaskToOriginal(prepared, mask);
  report(72);

  return polishCutout(originalBlob, fullResAlpha, prepared.origW, prepared.origH, (p) =>
    report(72 + p * 28)
  );
}
