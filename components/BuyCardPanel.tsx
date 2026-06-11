"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEAMS } from "@/lib/card";
import {
  buildCardShareUrl,
  buildShareCopy,
  type CardShareState,
  type SharePlatform,
} from "@/lib/cardShareUrl";
import { waitForCardReady } from "@/lib/waitForCardReady";
import {
  recordCardVideo,
  RecordAbortedError,
  videoDownloadFilename,
  videoFileExtension,
} from "@/lib/recordCardVideo";
import { resetCardPointerState } from "@/lib/cardPointerState";
import { cardImageDownloadFilename, captureCardPng } from "@/lib/captureCardImage";
import { celebrateTeamConfetti } from "@/lib/teamConfetti";
import CheckoutModal from "@/components/CheckoutModal";

type BuyCardPanelProps = CardShareState & {
  captureRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
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
}: BuyCardPanelProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  const videoUrlRef = useRef<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const renderGenRef = useRef(0);
  const renderPromiseRef = useRef<Promise<Blob> | null>(null);

  const shareState = { name, team, cardStyle, shine, finish };
  const shareUrl = buildCardShareUrl(shareState);
  const shareText = buildShareCopy(shareState);
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

  const storeImageBlob = useCallback((blob: Blob) => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = URL.createObjectURL(blob);
    setImageBlob(blob);
  }, []);

  const cleanupImage = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setImageBlob(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupVideo();
      cleanupImage();
    };
  }, [cleanupVideo, cleanupImage]);

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
    if (!videoBlob || !url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = videoDownloadFilename(slug, videoBlob);
    a.click();
  }, [slug, videoBlob]);

  const downloadImage = useCallback(() => {
    const url = imageUrlRef.current;
    if (!imageBlob || !url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = cardImageDownloadFilename(slug);
    a.click();
  }, [slug, imageBlob]);

  const generateAndDownload = useCallback(async () => {
    if (rendering) return;
    setRendering(true);
    setReady(false);
    setError(null);
    cleanupImage();

    try {
      const stage = captureRef.current;
      if (!stage) throw new Error("Could not find your card to render.");
      await waitForCardReady(stage);
      const [, image] = await Promise.all([ensureVideo(), captureCardPng(stage)]);
      storeImageBlob(image);
      downloadVideo();
      setReady(true);
      if (kit) celebrateTeamConfetti([kit.c1, kit.c2, kit.accent]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your video.");
    } finally {
      setRendering(false);
    }
  }, [
    captureRef,
    cleanupImage,
    downloadVideo,
    ensureVideo,
    kit,
    rendering,
    storeImageBlob,
  ]);

  const handleDownloadClick = () => {
    setOpen(true);
    void generateAndDownload();
  };

  const close = () => {
    if (rendering) return;
    renderGenRef.current += 1;
    renderPromiseRef.current = null;
    restoreStage();
    setOpen(false);
    setRendering(false);
    setReady(false);
    setError(null);
    setCopied(false);
    cleanupVideo();
    cleanupImage();
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
    const ext = videoFileExtension(videoBlob);
    const file = new File([videoBlob], `world-cup-card.${ext}`, { type: videoBlob.type });
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
        className={`buyBtnWrap${btnHover ? " buyBtnWrap-hover" : ""}${disabled ? " buyBtnWrap-disabled" : ""}`}
        style={kitStyle}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
      >
        <button
          type="button"
          className="buyBtn"
          disabled={disabled}
          aria-label="Download holo card video"
          onClick={handleDownloadClick}
        >
          Download
        </button>
      </div>

      <CheckoutModal
        open={open}
        onClose={close}
        rendering={rendering}
        error={error}
        ready={ready}
        videoUrl={videoUrl}
        onDownloadVideo={downloadVideo}
        onDownloadImage={downloadImage}
        imageReady={!!imageBlob}
        onRetry={() => void generateAndDownload()}
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
