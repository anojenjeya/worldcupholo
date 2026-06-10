import { type Finish, type Shine } from "./card";
import { idleGlow, pointerGlow } from "./shine-finish";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Smooth ease — zero velocity at both ends. */
function smootherStep(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Gentle ease-in-out for cinematic beats. */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Normalized point on a rounded-rect perimeter — clockwise from top edge. */
export function perimeterHoverPoint(
  t: number,
  inset = 0.055,
  cornerFrac = 0.1
): { x: number; y: number } {
  const u = (((t % 1) + 1) % 1);
  const min = inset;
  const max = 1 - inset;
  const w = max - min;
  const h = max - min;
  const r = Math.min(cornerFrac, w / 2, h / 2);

  const sideW = w - 2 * r;
  const sideH = h - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  const total = 2 * sideW + 2 * sideH + 4 * arcLen;

  let d = u * total;

  // Top edge → top-right corner → right → bottom-right → bottom → bottom-left → left → top-left
  if (d <= sideW) return { x: min + r + d, y: min };
  d -= sideW;

  if (d <= arcLen) {
    const a = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    return { x: max - r + r * Math.cos(a), y: min + r + r * Math.sin(a) };
  }
  d -= arcLen;

  if (d <= sideH) return { x: max, y: min + r + d };
  d -= sideH;

  if (d <= arcLen) {
    const a = (d / arcLen) * (Math.PI / 2);
    return { x: max - r + r * Math.cos(a), y: max - r + r * Math.sin(a) };
  }
  d -= arcLen;

  if (d <= sideW) return { x: max - r - d, y: max };
  d -= sideW;

  if (d <= arcLen) {
    const a = Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    return { x: min + r + r * Math.cos(a), y: max - r + r * Math.sin(a) };
  }
  d -= arcLen;

  if (d <= sideH) return { x: min, y: max - r - d };
  d -= sideH;

  const a = Math.PI + (d / arcLen) * (Math.PI / 2);
  return { x: min + r + r * Math.cos(a), y: min + r + r * Math.sin(a) };
}

export function applyCardPointerState(
  card: HTMLElement,
  x: number,
  y: number,
  opts?: {
    gloss?: number;
    active?: boolean;
    tiltMul?: number;
    tiltDeg?: number;
    scaleBoost?: boolean;
    /** Extra holo shift for video capture. */
    motionBoost?: boolean;
    /** Explicit scale for video capture choreography. */
    recordScale?: number;
  }
) {
  const finish = (card.dataset.finish ?? "gloss") as Finish;
  const matte = finish === "matte";
  const px = (x - 0.5) * 2;
  const py = (y - 0.5) * 2;
  const tilt = opts?.tiltMul ?? 1;
  const tiltDeg = opts?.tiltDeg ?? 13;
  const boost = opts?.motionBoost ?? false;
  const bgShift = boost ? 48 : 45;
  const hueX = boost ? 98 : 90;
  const hueY = boost ? 38 : 35;

  if (opts?.active !== false) card.dataset.active = "1";

  card.style.setProperty("--ry", `${(px * tiltDeg * tilt).toFixed(2)}deg`);
  card.style.setProperty("--rx", `${(-py * tiltDeg * tilt).toFixed(2)}deg`);
  card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  card.style.setProperty("--bgx", `${(50 + px * bgShift).toFixed(1)}%`);
  card.style.setProperty("--bgy", `${(50 + py * bgShift).toFixed(1)}%`);
  card.style.setProperty("--hue", `${(px * hueX + py * hueY).toFixed(1)}`);

  if (opts?.recordScale !== undefined) {
    card.style.setProperty("--scale", opts.recordScale.toFixed(4));
  } else if (opts?.scaleBoost === false) {
    card.style.setProperty("--scale", "1");
  } else if (boost) {
    card.style.setProperty("--scale", matte ? "1.024" : "1.042");
  } else {
    card.style.setProperty("--scale", matte ? "1.018" : "1.035");
  }

  const g =
    opts?.gloss ??
    clamp(1 - Math.hypot(px, py) * 0.7, 0, 1);
  card.style.setProperty("--glow", pointerGlow(finish, g).toFixed(3));
}

/** Stronger holo response for video capture — shine follows the cursor at the edges. */
export function recordPointerGloss(x: number, y: number) {
  const px = (x - 0.5) * 2;
  const py = (y - 0.5) * 2;
  return clamp(0.58 + Math.hypot(px, py) * 0.42, 0.58, 1);
}

export function resetCardPointerState(card: HTMLElement) {
  const finish = (card.dataset.finish ?? "gloss") as Finish;
  const shine = (card.dataset.shine ?? "rainbow") as Shine;
  delete card.dataset.active;
  card.style.setProperty("--rx", "0deg");
  card.style.setProperty("--ry", "0deg");
  card.style.setProperty("--mx", "50%");
  card.style.setProperty("--my", "40%");
  card.style.setProperty("--bgx", "50%");
  card.style.setProperty("--bgy", "50%");
  card.style.setProperty("--hue", "0");
  card.style.setProperty("--glow", idleGlow(shine, finish).toFixed(3));
  card.style.setProperty("--scale", "1");
}

export type ChoreographyFrame = {
  x: number;
  y: number;
  fade: number;
  scale: number;
  vignette: number;
};

const HERO_POINT = { x: 0.58, y: 0.24 };

/** Cinematic hover tour: intro → edge glide → hero hold → fade out. */
export function choreographHoverAt(t: number): ChoreographyFrame {
  const introEnd = 0.07;
  const tourEnd = 0.76;
  const heroEnd = 0.87;

  if (t <= introEnd) {
    const p = easeInOutCubic(t / introEnd);
    return {
      x: 0.5,
      y: 0.5,
      fade: lerp(0.22, 0, p),
      scale: lerp(0.94, 1, p),
      vignette: lerp(0.42, 0.1, p),
    };
  }

  if (t <= tourEnd) {
    const local = (t - introEnd) / (tourEnd - introEnd);
    const eased = smootherStep(local);
    const pt = perimeterHoverPoint(eased);
    const breathe = 1 + Math.sin(local * Math.PI * 2.4) * 0.008;
    return {
      ...pt,
      fade: 0,
      scale: breathe,
      vignette: 0.06 + Math.sin(local * Math.PI) * 0.04,
    };
  }

  if (t <= heroEnd) {
    const p = easeInOutCubic((t - tourEnd) / (heroEnd - tourEnd));
    const start = perimeterHoverPoint(1);
    return {
      x: lerp(start.x, HERO_POINT.x, p),
      y: lerp(start.y, HERO_POINT.y, p),
      fade: 0,
      scale: lerp(1, 1.028, p),
      vignette: lerp(0.08, 0.14, p),
    };
  }

  const fadeT = smootherStep((t - heroEnd) / (1 - heroEnd));
  return {
    x: lerp(HERO_POINT.x, 0.5, fadeT * 0.18),
    y: lerp(HERO_POINT.y, 0.5, fadeT * 0.18),
    fade: fadeT,
    scale: lerp(1.028, 0.99, fadeT),
    vignette: lerp(0.14, 0.48, fadeT),
  };
}

export function choreographHoverFrame(frame: number, total: number): ChoreographyFrame {
  return choreographHoverAt(frame / Math.max(total - 1, 1));
}
