"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STYLES, TEAMS } from "@/lib/card";
import { CHARITY } from "@/lib/charity";
import {
  buildCardShareUrl,
  buildShareCopy,
  type CardShareState,
  type SharePlatform,
} from "@/lib/cardShareUrl";
import { PRICE_LABEL } from "@/lib/pricing";
import { clearPendingCheckout, savePendingCheckout } from "@/lib/pendingCheckout";
import { waitForCardReady } from "@/lib/waitForCardReady";
import { recordCardVideo, RecordAbortedError } from "@/lib/recordCardVideo";
import { resetCardPointerState } from "@/lib/cardPointerState";
import CheckoutModal from "@/components/CheckoutModal";

type BuyCardPanelProps = CardShareState & {
  captureRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  photoUrl?: string | null;
  photoCutout?: boolean;
  checkoutSessionId?: string | null;
  checkoutCancelled?: boolean;
  onCheckoutHandled?: () => void;
};

const PLATFORMS: SharePlatform[] = [
  { id: "native", label: "Share…" },
  {
    id: "twitter",
    label: "X / Twitter",
    href: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    href: () => "https://www.instagram.com/",
    note: "Your video downloads first — then upload it in the Instagram app.",
  },
];

export default function BuyCardPanel({
  captureRef,
  disabled,
  name,
  team,
  cardStyle,
  shine,
  finish,
  photoUrl = null,
  photoCutout = false,
  checkoutSessionId,
  checkoutCancelled = false,
  onCheckoutHandled,
}: BuyCardPanelProps) {
  const [open, setOpen] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutPhase, setCheckoutPhase] = useState<"idle" | "redirect" | "render">("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyHover, setBuyHover] = useState(false);

  const videoUrlRef = useRef<string | null>(null);
  const renderGenRef = useRef(0);
  const renderPromiseRef = useRef<Promise<Blob> | null>(null);
  const fulfilledSessionRef = useRef<string | null>(null);

  const shareState = { name, team, cardStyle, shine, finish };
  const shareUrl = buildCardShareUrl(shareState);
  const shareText = buildShareCopy(shareState);
  const styleName = STYLES.find((s) => s.id === cardStyle)?.name ?? "Prizm";
  const displayName = name.trim() || "Player";
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const kit = TEAMS[team];
  const kitStyle = kit
    ? ({
        "--kit-c1": kit.c1,
        "--kit-c2": kit.c2,
        "--kit-accent": kit.accent,
      } as React.CSSProperties)
    : undefined;

  const storeVideoBlob = useCallback((blob: Blob) => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(blob);
    videoUrlRef.current = url;
    setVideoUrl(url);
    setVideoBlob(blob);
  }, []);

  const cleanupVideo = useCallback(() => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setVideoBlob(null);
  }, []);

  useEffect(() => {
    return () => cleanupVideo();
  }, [cleanupVideo]);

  const restoreStage = useCallback(() => {
    const stage = captureRef.current;
    if (!stage) return;
    delete stage.dataset.recording;
    const card = stage.querySelector<HTMLElement>("[data-card-root]");
    if (card) {
      delete card.dataset.active;
      resetCardPointerState(card);
    }
  }, [captureRef]);

  const startRender = useCallback(() => {
    const stage = captureRef.current;
    if (!stage) return;

    renderGenRef.current += 1;
    const gen = renderGenRef.current;
    setError(null);
    cleanupVideo();

    const promise = recordCardVideo({
      stage,
      onProgress: () => {},
      shouldAbort: () => gen !== renderGenRef.current,
    })
      .then((blob) => {
        if (gen === renderGenRef.current) {
          storeVideoBlob(blob);
        }
        return blob;
      })
      .catch((err) => {
        if (gen === renderGenRef.current && !(err instanceof RecordAbortedError)) {
          console.error(err);
        }
        throw err;
      })
      .finally(() => {
        if (gen === renderGenRef.current) {
          renderPromiseRef.current = null;
        }
      });

    promise.catch(() => {});
    renderPromiseRef.current = promise;
  }, [captureRef, cleanupVideo, storeVideoBlob]);

  const ensureVideo = useCallback(async (): Promise<Blob> => {
    if (videoBlob && videoUrlRef.current) return videoBlob;

    const runRender = async () => {
      if (!renderPromiseRef.current) startRender();
      const promise = renderPromiseRef.current;
      if (!promise) throw new Error("Could not start video render.");
      const blob = await promise;
      if (!videoUrlRef.current) storeVideoBlob(blob);
      return blob;
    };

    try {
      return await runRender();
    } catch (err) {
      if (!(err instanceof RecordAbortedError)) throw err;
      startRender();
      return runRender();
    }
  }, [startRender, storeVideoBlob, videoBlob]);

  const downloadVideo = useCallback(() => {
    const url = videoUrlRef.current;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "world-cup-card"}.webm`;
    a.click();
  }, [slug]);

  const fulfillPaidOrder = useCallback(
    async (sessionId: string) => {
      if (fulfilledSessionRef.current === sessionId) return;
      fulfilledSessionRef.current = sessionId;

      setOpen(true);
      setCheckingOut(true);
      setCheckoutPhase("render");
      setError(null);
      setPurchased(false);

      try {
        const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as { paid?: boolean; error?: string };
        if (!res.ok || !data.paid) {
          throw new Error(data.error || "Payment could not be verified. Please contact support.");
        }

        const stage = captureRef.current;
        if (!stage) throw new Error("Could not find your card to render.");
        await waitForCardReady(stage);

        await ensureVideo();
        downloadVideo();
        setPurchased(true);
        clearPendingCheckout();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete your order.");
      } finally {
        setCheckingOut(false);
        setCheckoutPhase("idle");
        onCheckoutHandled?.();
      }
    },
    [captureRef, downloadVideo, ensureVideo, onCheckoutHandled]
  );

  useEffect(() => {
    if (!checkoutSessionId) return;
    void fulfillPaidOrder(checkoutSessionId);
  }, [checkoutSessionId, fulfillPaidOrder]);

  useEffect(() => {
    if (!checkoutCancelled) return;
    setOpen(true);
    setError("Checkout cancelled. Your card is still here when you're ready.");
    onCheckoutHandled?.();
  }, [checkoutCancelled, onCheckoutHandled]);

  const close = () => {
    if (checkingOut) return;
    renderGenRef.current += 1;
    renderPromiseRef.current = null;
    restoreStage();
    setOpen(false);
    setCheckingOut(false);
    setCheckoutPhase("idle");
    setPurchased(false);
    setError(null);
    setCopied(false);
    cleanupVideo();
  };

  const purchase = async () => {
    if (checkingOut) return;
    setCheckingOut(true);
    setCheckoutPhase("redirect");
    setError(null);

    try {
      await savePendingCheckout({
        name: displayName,
        team,
        cardStyle,
        shine,
        finish,
        photoUrl,
        photoCutout,
      });

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          team,
          cardStyle,
          shine,
          finish,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start secure checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start secure checkout.");
      setCheckingOut(false);
      setCheckoutPhase("idle");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  const shareNative = async () => {
    if (!videoBlob) return;
    const file = new File([videoBlob], "world-cup-card.webm", { type: videoBlob.type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "World Cup 2026 Holo Card",
        text: shareText,
        url: shareUrl,
        files: [file],
      });
      return;
    }
    downloadVideo();
  };

  const openPlatform = (platform: SharePlatform) => {
    if (platform.id === "native") {
      void shareNative();
      return;
    }

    if (platform.id === "instagram") {
      downloadVideo();
    }

    const href = platform.href?.(shareUrl, shareText);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <div
        className={`buyBtnWrap${buyHover ? " buyBtnWrap-hover" : ""}${disabled ? " buyBtnWrap-disabled" : ""}`}
        style={kitStyle}
        onMouseEnter={() => setBuyHover(true)}
        onMouseLeave={() => setBuyHover(false)}
      >
        <button
          type="button"
          className="buyBtn"
          disabled={disabled}
          aria-label={`Buy card for ${PRICE_LABEL}`}
          onClick={() => setOpen(true)}
        >
          Buy card {PRICE_LABEL}
        </button>
        <p className="buyBtnCharity">{CHARITY.tagline}</p>
      </div>

      <CheckoutModal
        open={open}
        onClose={close}
        checkingOut={checkingOut}
        checkoutPhase={checkoutPhase}
        error={error}
        purchased={purchased}
        videoUrl={videoUrl}
        displayName={displayName}
        team={team}
        styleName={styleName}
        finish={finish}
        captureRef={captureRef}
        onPurchase={() => void purchase()}
        onDownload={downloadVideo}
        onCopyLink={() => void copyLink()}
        copied={copied}
        shareUrl={shareUrl}
        shareText={shareText}
        platforms={PLATFORMS}
        onPlatform={openPlatform}
      />
    </>
  );
}
