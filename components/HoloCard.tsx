"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  TEAMS,
  STYLES,
  crestUrl,
  buildShineFinishVars,
  idleGlow,
  type CardStyle,
  type Shine,
  type Finish,
} from "@/lib/card";
import {
  applyCardPointerState,
  resetCardPointerState,
} from "@/lib/cardPointerState";
import { analyzeCardPhotoFit, type CardPhotoFit } from "@/lib/fitCardPhoto";
import FlagImg from "@/components/FlagImg";
import styles from "./HoloCard.module.css";

const SHINE_CLASS: Record<Shine, string> = {
  rainbow: styles.shineRainbow,
  diamond: styles.shineDiamond,
  sapphire: styles.shineSapphire,
  emerald: styles.shineEmerald,
  ruby: styles.shineRuby,
};

export type HoloCardProps = {
  /** Raw name — seeds stats and rarity. */
  name: string;
  team: string;
  /** Visual treatment / template. */
  cardStyle?: CardStyle;
  /** Foil shine color. */
  shine?: Shine;
  /** Surface finish — holographic gloss or soft matte. */
  finish?: Finish;
  /** Object URL or remote URL for the portrait. */
  photoUrl?: string | null;
  /** True when photoUrl is a transparent PNG cutout. */
  photoCutout?: boolean;
  /** Background removal in progress. */
  processing?: boolean;
  processingMessage?: string;
  processingProgress?: number;
  /** Assigned to the outer stage wrapper for video capture. */
  stageRef?: React.Ref<HTMLDivElement>;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const NAME_MAX_SIZE = 44;
const NAME_MIN_SIZE = 13;

function measureNameWidth(
  text: string,
  size: number,
  fontFamily: string,
  fontWeight: string,
  letterSpacingEm: number
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  const base = ctx.measureText(text).width;
  const tracking = Math.max(0, text.length - 1) * letterSpacingEm * size;
  return base + tracking;
}

function fitPlayerName(el: HTMLDivElement, card: HTMLElement | null) {
  const label = (el.textContent || "Player").trim() || "Player";
  const display = label.toUpperCase();
  const container = el.parentElement;
  const stage = card?.parentElement;
  const recording = stage?.hasAttribute("data-recording");
  const cs = getComputedStyle(el);
  const fontFamily = cs.fontFamily;
  const fontWeight = cs.fontWeight;
  const letterSpacingEm = (() => {
    const ls = cs.letterSpacing;
    if (!ls || ls === "normal") return 0.01;
    if (ls.endsWith("em")) return parseFloat(ls) || 0.01;
    if (ls.endsWith("px")) return (parseFloat(ls) || 0) / NAME_MAX_SIZE;
    return 0.01;
  })();

  const edgePad = recording ? 14 : 8;
  const maxWidth = Math.max(
    0,
    Math.floor((container?.clientWidth ?? el.clientWidth) - edgePad)
  );
  if (!maxWidth) return;

  let size = NAME_MAX_SIZE;
  while (size > NAME_MIN_SIZE && measureNameWidth(display, size, fontFamily, fontWeight, letterSpacingEm) > maxWidth) {
    size -= 1;
  }

  const singleLineFits =
    measureNameWidth(display, size, fontFamily, fontWeight, letterSpacingEm) <= maxWidth;

  if (singleLineFits) {
    el.style.whiteSpace = "nowrap";
    el.style.lineHeight = "0.92";
    el.style.fontSize = `${size}px`;
    return;
  }

  el.style.whiteSpace = "normal";
  el.style.lineHeight = "0.88";
  size = Math.min(size, NAME_MIN_SIZE + 4);
  el.style.fontSize = `${size}px`;
  while (size > 11 && el.scrollHeight > size * 2.15) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
}

export default function HoloCard({
  name,
  team,
  cardStyle = "prizm",
  shine = "rainbow",
  finish = "gloss",
  photoUrl,
  photoCutout = false,
  processing = false,
  processingMessage = "Removing background…",
  processingProgress = 0,
  stageRef,
}: HoloCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const photoFitGenRef = useRef(0);
  const [photoFit, setPhotoFit] = useState<CardPhotoFit | null>(null);

  const raw = name || "Player";
  const t = TEAMS[team] ?? TEAMS.Brazil;
  const { accent, c1, c2, code, cheer } = t;
  const brand = STYLES.find((x) => x.id === cardStyle)?.name ?? "Prizm";
  const crest = crestUrl(team);
  const shineFinishVars = buildShineFinishVars(shine, finish);

  // Pointer + gyro drive CSS custom properties; rAF throttles writes.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.dataset.finish = finish;
    card.dataset.shine = shine;

    let raf = 0;
    let pending: { x: number; y: number; gloss?: number } | null = null;

    const apply = () => {
      raf = 0;
      if (!pending) return;
      applyCardPointerState(card, pending.x, pending.y, { gloss: pending.gloss });
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onMove = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      pending = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      schedule();
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pending = null;
      resetCardPointerState(card);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const px = clamp(e.gamma / 30, -1, 1);
      const py = clamp((e.beta - 45) / 30, -1, 1);
      pending = { x: (px + 1) / 2, y: (py + 1) / 2, gloss: 0.8 };
      schedule();
    };

    // Preview/screenshot helper: ?demo freezes the card mid-tilt + ignited.
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("demo")
    ) {
      pending = { x: 0.66, y: 0.36, gloss: 0.72 };
      apply();
    }

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    window.addEventListener("deviceorientation", onTilt, true);
    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onTilt, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [finish, shine]);

  useEffect(() => {
    if (!photoUrl || !photoCutout) {
      photoFitGenRef.current += 1;
      setPhotoFit(null);
      return;
    }

    const gen = ++photoFitGenRef.current;
    void analyzeCardPhotoFit(photoUrl).then((fit) => {
      if (gen === photoFitGenRef.current) setPhotoFit(fit);
    });
  }, [photoUrl, photoCutout]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--glow", idleGlow(shine, finish).toFixed(3));
  }, [finish, shine]);

  useLayoutEffect(() => {
    const el = nameRef.current;
    const card = cardRef.current;
    if (!el || !card) return;

    const fit = () => fitPlayerName(el, card);

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    const stage = card.parentElement;
    const mo = stage
      ? new MutationObserver(fit)
      : null;
    if (stage && mo) {
      mo.observe(stage, { attributes: true, attributeFilter: ["data-recording"] });
    }

    return () => {
      ro.disconnect();
      mo?.disconnect();
    };
  }, [raw]);

  return (
    <div ref={stageRef} className={styles.stage}>
      <div
        ref={cardRef}
        data-card-root
        className={`${styles.card} ${styles[cardStyle]} ${SHINE_CLASS[shine]}${finish === "matte" ? ` ${styles.matte}` : ""}`}
        data-finish={finish}
        data-shine={shine}
        style={
          {
            ...shineFinishVars,
            "--accent": accent,
            "--t1": c1,
            "--t2": c2,
          } as React.CSSProperties
        }
      >
        <div className={`${styles.layer} ${styles.bg}`} />
        <div className={styles.artScene}>
          <div className={`${styles.layer} ${styles.fullArt}`} />
          <div className={`${styles.layer} ${styles.fullArtSpecks}`} />
          <div className={`${styles.layer} ${styles.facets}`} />
          <div className={`${styles.layer} ${styles.holo}`} />
          <div className={`${styles.layer} ${styles.holo2}`} />
          <div className={`${styles.layer} ${styles.photoBackdrop}`} />
          {photoUrl ? (
            <div
              className={`${styles.layer} ${styles.photo}${
                photoCutout ? ` ${styles.photoCutout}` : ` ${styles.photoLegacy}`
              }`}
              style={
                photoCutout && photoFit
                  ? ({
                      "--photo-width": `${photoFit.widthPct}%`,
                      "--photo-y": `${photoFit.translateY}px`,
                    } as React.CSSProperties)
                  : !photoCutout
                    ? { backgroundImage: `url(${photoUrl})` }
                    : undefined
              }
            >
              {photoCutout ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.photoImg}
                  src={photoUrl}
                  alt=""
                  draggable={false}
                  data-card-photo
                  {...(photoUrl.startsWith("http") ? { crossOrigin: "anonymous" as const } : {})}
                />
              ) : null}
            </div>
          ) : (
            <div className={`${styles.layer} ${styles.photo} ${styles.empty}`} />
          )}
          <div className={`${styles.layer} ${styles.fullArtFade}`} />
          {photoUrl ? (
            <div
              className={`${styles.layer} ${styles.photoShine}${
                photoCutout ? "" : ` ${styles.photoShineLegacy}`
              }`}
            />
          ) : null}
        </div>
        <div className={`${styles.layer} ${styles.rim}`} />
        <div className={`${styles.layer} ${styles.sweep}`} />
        <div className={`${styles.layer} ${styles.glare}`} />
        <div className={`${styles.layer} ${styles.frame}`} />
        <div className={`${styles.layer} ${styles.frameInner}`} />

        <div className={styles.content}>
          <div className={styles.top}>
            <div className={styles.brand}>
              <b>World Cup</b>
              <i>2026</i>
              <span>{brand} Edition</span>
            </div>
            <FlagImg
              className={styles.flag}
              code={code}
              size={46}
              priority
              crossOrigin="anonymous"
            />
          </div>

          <div className={`${styles.bottom}${crest ? ` ${styles.bottomWithCrest}` : ""}`}>
            <div className={styles.bottomMain}>
              <div ref={nameRef} className={styles.name} data-player-name>
                {raw}
              </div>
              <div className={styles.sub}>
                <span className={styles.cheer}>{cheer}</span>
              </div>
            </div>
            {crest ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.crest}
                src={crest}
                alt={`${team} crest`}
                width={56}
                height={56}
                draggable={false}
                crossOrigin="anonymous"
              />
            ) : null}
          </div>
        </div>

        {processing ? (
          <div className={styles.processing} data-recording-hide>
            <div className={styles.processingInner}>
              <p className={styles.processingMsg} aria-live="polite">
                {processingMessage}
              </p>
              <div
                className={styles.processingTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={processingProgress}
              >
                <div
                  className={styles.processingBar}
                  style={{
                    transform: `scaleX(${Math.min(100, Math.max(0, processingProgress)) / 100})`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
