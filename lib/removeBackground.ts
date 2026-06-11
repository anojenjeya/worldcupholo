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

/** Max working edge — card display needs ~640px; smaller = faster decode/encode. */
const WORK_MAX_SIDE = 640;

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
        report(4 + ratio * 28);
      } else if (key.startsWith("compute:")) {
        report(34 + ratio * 64);
      }
    },
  };
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

export type RemoveBgCallbacks = {
  onProgress?: (pct: number) => void;
  onPreview?: (blob: Blob) => void;
};

function normalizeCallbacks(
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): RemoveBgCallbacks {
  if (typeof callbacks === "function") return { onProgress: callbacks };
  return callbacks ?? {};
}

export async function removePhotoBackground(
  src: Blob | string,
  callbacks?: RemoveBgCallbacks | ((pct: number) => void)
): Promise<Blob> {
  const { onProgress, onPreview } = normalizeCallbacks(callbacks);
  const report = (pct: number) => onProgress?.(Math.min(100, Math.round(pct)));

  await preloadBackgroundRemoval().catch(() => undefined);

  const { removeBackground } = await importBgRemoval();

  report(2);
  const original = await toBlob(src);
  report(8);
  const work = await resizeToMaxSide(original, WORK_MAX_SIDE);
  report(12);

  const cutout = await removeBackground(work, buildConfig(onProgress));

  onPreview?.(cutout);
  report(100);
  return cutout;
}
