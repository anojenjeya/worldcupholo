import { createContext, destroyContext, domToCanvas } from "modern-screenshot";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  applyCardPointerState,
  choreographHoverAt,
  recordPointerGloss,
  resetCardPointerState,
} from "./cardPointerState";
import { waitForCardReady } from "./waitForCardReady";

export type RecordCardOptions = {
  stage: HTMLElement;
  durationMs?: number;
  fps?: number;
  scale?: number;
  /** Card occupies this fraction of the output frame (0–1). Higher = more zoomed in. */
  frameCardScale?: number;
  onProgress?: (progress: number) => void;
  shouldAbort?: () => boolean;
};

export class RecordAbortedError extends Error {
  name = "RecordAbortedError";
}

function throwIfAborted(shouldAbort?: () => boolean) {
  if (shouldAbort?.()) throw new RecordAbortedError();
}

const DURATION_MS = 10_000;
const RECORD_MOTION = {
  tiltMul: 0.92,
  tiltDeg: 14,
  scaleBoost: false,
  motionBoost: true,
};

function supportsWebCodecs() {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function waitForPaint() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function pickMimeType() {
  const types = [
    "video/mp4",
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

export function videoFileExtension(blob: Blob): "mp4" | "webm" {
  return blob.type.includes("mp4") ? "mp4" : "webm";
}

export function videoDownloadFilename(slug: string, blob: Blob) {
  return `${slug || "world-cup-card"}.${videoFileExtension(blob)}`;
}

type FrameLayout = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  drawW: number;
  drawH: number;
};

function createFrameLayout(
  shotW: number,
  shotH: number,
  frameCardScale: number
): FrameLayout {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(shotW / frameCardScale);
  canvas.height = Math.round(shotH / frameCardScale);
  const drawW = Math.round(shotW * frameCardScale);
  const drawH = Math.round(shotH * frameCardScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create recording canvas.");
  return {
    canvas,
    ctx,
    x: Math.round((canvas.width - drawW) / 2),
    y: Math.round((canvas.height - drawH) / 2),
    drawW,
    drawH,
  };
}

function paintFrame(
  layout: FrameLayout,
  shot: HTMLCanvasElement,
  fade: number,
  vignette = 0,
  bg = "#060709"
) {
  const { ctx, x, y, drawW, drawH, canvas } = layout;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(shot, 0, 0, shot.width, shot.height, x, y, drawW, drawH);

  if (vignette > 0) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.max(canvas.width, canvas.height) * 0.78;
    const grd = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(0.55, `rgba(0,0,0,${vignette * 0.18})`);
    grd.addColorStop(1, `rgba(0,0,0,${Math.min(0.72, vignette * 0.82)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (fade > 0) {
    ctx.fillStyle = `rgba(6, 7, 9, ${Math.min(1, fade * 1.02)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function applyRecordPointer(
  card: HTMLElement,
  x: number,
  y: number,
  scale: number
) {
  applyCardPointerState(card, x, y, {
    ...RECORD_MOTION,
    gloss: recordPointerGloss(x, y),
    recordScale: scale,
  });
}

async function pickH264Codec(width: number, height: number, fps: number) {
  const candidates = ["avc1.42001f", "avc1.4D401F", "avc1.640028", "avc1.64001f"];
  for (const codec of candidates) {
    if (typeof VideoEncoder === "undefined") break;
    const result = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      bitrate: 12_000_000,
      framerate: fps,
    });
    if (result.supported) return codec;
  }
  return null;
}

async function encodeWithWebCodecs(
  layout: FrameLayout,
  fps: number,
  frameCount: number,
  captureFrame: (index: number) => Promise<void>,
  onProgress?: (progress: number) => void,
  shouldAbort?: () => boolean
): Promise<Blob | null> {
  const { canvas } = layout;
  const codec = await pickH264Codec(canvas.width, canvas.height, fps);
  if (!codec) return null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: canvas.width,
      height: canvas.height,
      frameRate: fps,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      throw err;
    },
  });

  encoder.configure({
    codec,
    width: canvas.width,
    height: canvas.height,
    bitrate: 12_000_000,
    framerate: fps,
  });

  const frameDurUs = Math.round(1_000_000 / fps);

  try {
    for (let i = 0; i < frameCount; i++) {
      throwIfAborted(shouldAbort);
      await captureFrame(i);
      throwIfAborted(shouldAbort);
      const videoFrame = new VideoFrame(canvas, { timestamp: i * frameDurUs });
      encoder.encode(videoFrame, { keyFrame: i % fps === 0 });
      videoFrame.close();
      onProgress?.(0.05 + (0.95 * (i + 1)) / frameCount);
    }

    await encoder.flush();
    muxer.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    encoder.close();
  }
}

async function encodeWithMediaRecorder(
  layout: FrameLayout,
  fps: number,
  frameCount: number,
  captureFrame: (index: number) => Promise<void>,
  onProgress?: (progress: number) => void,
  shouldAbort?: () => boolean
): Promise<Blob> {
  const mimeType = pickMimeType();
  const stream = layout.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 12_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error("Recording failed."));
  });

  recorder.start();
  const frameInterval = 1000 / fps;
  const start = performance.now();

  try {
    for (let i = 0; i < frameCount; i++) {
      throwIfAborted(shouldAbort);
      const due = start + i * frameInterval;
      const wait = due - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      await captureFrame(i);
      throwIfAborted(shouldAbort);
      track.requestFrame?.();
      onProgress?.(0.05 + (0.95 * (i + 1)) / frameCount);
    }

    await new Promise((r) => setTimeout(r, frameInterval));
    recorder.stop();
    return finished;
  } catch (err) {
    if (recorder.state !== "inactive") recorder.stop();
    throw err;
  }
}

export async function recordCardVideo({
  stage,
  durationMs = DURATION_MS,
  fps = 30,
  scale = 2,
  frameCardScale = 0.78,
  onProgress,
  shouldAbort,
}: RecordCardOptions): Promise<Blob> {
  if (!supportsWebCodecs() && typeof MediaRecorder === "undefined") {
    throw new Error("Video recording is not supported in this browser.");
  }

  const card = stage.querySelector<HTMLElement>("[data-card-root]");
  if (!card) throw new Error("Could not find card element to record.");

  stage.dataset.recording = "1";
  card.dataset.active = "1";

  const frameCount = Math.round((durationMs / 1000) * fps);

  const captureOpts = {
    scale,
    backgroundColor: "#060709",
    drawImageInterval: 0,
    features: {
      copyScrollbar: false,
      removeAbnormalAttributes: true,
      removeControlCharacter: true,
      fixSvgXmlDecode: false,
    },
    fetch: { requestInit: { mode: "cors" as RequestMode, cache: "force-cache" as RequestCache } },
    filter: (node: Node) =>
      !(node instanceof HTMLElement && node.dataset.recordingHide !== undefined),
  };

  let context: Awaited<ReturnType<typeof createContext>> | null = null;
  let layout: FrameLayout | null = null;

  try {
    onProgress?.(0.02);

    await waitForCardReady(stage);
    await waitForPaint();
    await waitForPaint();
    const captureRect = stage.getBoundingClientRect();
    context = await createContext(stage, {
      ...captureOpts,
      width: captureRect.width,
      height: captureRect.height,
      autoDestruct: false,
    });

    const intro = choreographHoverAt(0);
    applyRecordPointer(card, intro.x, intro.y, intro.scale);
    await waitForPaint();
    const warmShot = await domToCanvas(context);
    layout = createFrameLayout(warmShot.width, warmShot.height, frameCardScale);

    const captureFrame = async (index: number) => {
      throwIfAborted(shouldAbort);
      const t = index / Math.max(frameCount - 1, 1);
      const beat = choreographHoverAt(t);
      applyRecordPointer(card, beat.x, beat.y, beat.scale);
      await waitForPaint();
      throwIfAborted(shouldAbort);
      paintFrame(layout!, await domToCanvas(context!), beat.fade, beat.vignette);
    };

    if (supportsWebCodecs()) {
      const mp4 = await encodeWithWebCodecs(
        layout,
        fps,
        frameCount,
        captureFrame,
        onProgress,
        shouldAbort
      );
      if (mp4) return mp4;
    }

    return await encodeWithMediaRecorder(
      layout,
      fps,
      frameCount,
      captureFrame,
      onProgress,
      shouldAbort
    );
  } finally {
    if (context) destroyContext(context);
    delete stage.dataset.recording;
    delete card.dataset.active;
    resetCardPointerState(card);
  }
}
