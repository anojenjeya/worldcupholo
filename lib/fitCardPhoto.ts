/** Card layout constants — keep in sync with HoloCard.module.css */
const CARD_W = 336;
const CARD_H = 470;
/** Global size trim applied after fit. */
const PHOTO_SIZE = 1;

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
      if (data[(y * w + x) * 4 + 3] <= 12) continue;
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

type SubjectShape = "portrait" | "balanced" | "wide";

function classifySubject(bounds: AlphaBounds): SubjectShape {
  const aspect = bounds.subjectW / bounds.subjectH;
  if (aspect > 1.12) return "wide";
  if (aspect < 0.72) return "portrait";
  return "balanced";
}

function fitSubjectInSafeZone(
  bounds: AlphaBounds,
  imgW: number,
  imgH: number
): CardPhotoFit | null {
  const availW = CARD_W - SAFE.side * 2;
  const availH = CARD_H - SAFE.top - SAFE.bottom;
  const safeBottomY = CARD_H - SAFE.bottom;
  const shape = classifySubject(bounds);
  const fill = shape === "wide" ? 0.96 : shape === "balanced" ? 0.94 : 0.9;
  const marginTop = shape === "wide" ? 6 : 8;
  const marginBottom = shape === "wide" ? 6 : 8;
  const centerFrac = shape === "portrait" ? 0.52 : 0.5;

  const topPad =
    shape === "portrait" ? Math.round(bounds.subjectH * 0.05) : Math.round(bounds.subjectH * 0.02);
  const topY = Math.max(0, bounds.minY - topPad);
  const bottomY = bounds.maxY;
  const spanH = Math.max(bottomY - topY, 1);

  const scaleFromHeight = (availH * fill) / spanH;
  const scaleFromWidth = (availW * fill) / bounds.subjectW;
  const maxScale = Math.min(scaleFromHeight, scaleFromWidth);

  const minW = shape === "wide" ? CARD_W * 0.98 : CARD_W * 1;
  const maxW = shape === "wide" ? CARD_W * 1.85 : CARD_W * 1.75;
  const displayW = clamp(maxScale * imgW, minW, maxW) * PHOTO_SIZE;
  const scale = displayW / imgW;
  const imgTop = (CARD_H - imgH * scale) / 2;

  const subjectCenterY = (bounds.minY + bounds.maxY) / 2;
  const subCenterOnCard = imgTop + subjectCenterY * scale;
  const targetCenter = SAFE.top + availH * centerFrac;

  let translateY = targetCenter - subCenterOnCard;

  const subTop = imgTop + bounds.minY * scale + translateY;
  const subBottom = imgTop + bounds.maxY * scale + translateY;

  if (subTop < SAFE.top + marginTop) {
    translateY += SAFE.top + marginTop - subTop;
  }
  if (subBottom > safeBottomY - marginBottom) {
    translateY -= subBottom - (safeBottomY - marginBottom);
  }

  const top = imgTop + bounds.minY * scale + translateY;
  const bottom = imgTop + bounds.maxY * scale + translateY;
  if (top < SAFE.top + marginTop || bottom > safeBottomY - marginBottom) {
    return null;
  }

  return {
    widthPct: Math.round((displayW / CARD_W) * 100),
    translateY: Math.round(translateY),
  };
}

/** Size and position a cutout subject for the holo card art zone. */
export async function analyzeCardPhotoFit(src: string): Promise<CardPhotoFit> {
  const fallback: CardPhotoFit = { widthPct: 132, translateY: 8 };

  try {
    const { data, w, h } = await loadImageData(src);
    const bounds = measureAlphaBounds(data, w, h);
    if (!bounds) return fallback;

    return fitSubjectInSafeZone(bounds, w, h) ?? fallback;
  } catch {
    return fallback;
  }
}
