/** Card layout constants — keep in sync with HoloCard.module.css */
const CARD_W = 336;
const CARD_H = 470;
/** Global size trim applied after fit (0.8 = 20% smaller). */
const PHOTO_SIZE = 0.8;

/** Visible art area — below header copy, above name block. */
const SAFE = {
  top: 84,
  bottom: 108,
  side: 18,
};

export type CardPhotoFit = {
  widthPct: number;
  translateY: number;
};

type AlphaBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  subjectW: number;
  subjectH: number;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function measureAlphaBounds(data: Uint8ClampedArray, w: number, h: number): AlphaBounds | null {
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

  if (maxX < minX || maxY < minY) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    subjectW: maxX - minX + 1,
    subjectH: maxY - minY + 1,
  };
}

async function loadImageData(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not read photo.");
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not analyze photo.");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, w, h };
}

function fitSubjectInSafeZone(
  bounds: AlphaBounds,
  imgW: number,
  imgH: number
): CardPhotoFit | null {
  const availW = CARD_W - SAFE.side * 2;
  const availH = CARD_H - SAFE.top - SAFE.bottom;
  const safeBottomY = CARD_H - SAFE.bottom;
  const marginTop = 12;
  const marginBottom = 12;
  const fill = 0.78;

  const headPad = Math.round(bounds.subjectH * 0.05);
  const topY = Math.max(0, bounds.minY - headPad);
  const bottomY = bounds.maxY;
  const spanH = Math.max(bottomY - topY, 1);
  const imgMid = imgH / 2;
  const cardMid = CARD_H / 2;

  const scaleFromHeight = (availH * fill) / spanH;
  const scaleFromWidth = (availW * fill) / bounds.subjectW;
  const scaleFromBottom = (safeBottomY - marginBottom - cardMid) / (bottomY - imgMid);
  const scaleFromTop = (SAFE.top + marginTop - cardMid) / (topY - imgMid);

  let maxScale = Math.min(scaleFromHeight, scaleFromWidth);

  if (bottomY > imgMid && scaleFromBottom > 0) {
    maxScale = Math.min(maxScale, scaleFromBottom);
  }
  if (topY < imgMid && scaleFromTop > 0) {
    maxScale = Math.min(maxScale, scaleFromTop);
  }

  maxScale *= 0.96;

  let displayW = clamp(maxScale * imgW, CARD_W * 0.95, CARD_W * 1.58) * PHOTO_SIZE;
  const scale = displayW / imgW;
  const imgTop = (CARD_H - imgH * scale) / 2;

  const subTop = imgTop + topY * scale;
  const subBottom = imgTop + bottomY * scale;
  const subCenter = (subTop + subBottom) / 2;
  const targetCenter = SAFE.top + availH * 0.52;

  let translateY = targetCenter - subCenter;

  let top = subTop + translateY;
  if (top < SAFE.top + marginTop) translateY += SAFE.top + marginTop - top;

  let bottom = subBottom + translateY;
  if (bottom > safeBottomY - marginBottom) translateY -= bottom - (safeBottomY - marginBottom);

  top = subTop + translateY;
  bottom = subBottom + translateY;
  if (top < SAFE.top + marginTop || bottom > safeBottomY - marginBottom) {
    return null;
  }

  return {
    widthPct: Math.round((displayW / CARD_W) * 100),
    translateY: Math.round(translateY),
  };
}

/** Size and position a cutout portrait for the holo card art zone. */
export async function analyzeCardPhotoFit(src: string): Promise<CardPhotoFit> {
  const fallback: CardPhotoFit = { widthPct: 114, translateY: 12 };

  try {
    const { data, w, h } = await loadImageData(src);
    const bounds = measureAlphaBounds(data, w, h);
    if (!bounds) return fallback;

    return fitSubjectInSafeZone(bounds, w, h) ?? fallback;
  } catch {
    return fallback;
  }
}
