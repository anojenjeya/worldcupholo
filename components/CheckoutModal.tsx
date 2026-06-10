"use client";

import { useEffect } from "react";
import type { SharePlatform } from "@/lib/cardShareUrl";

type CheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  rendering: boolean;
  error: string | null;
  ready: boolean;
  videoUrl: string | null;
  onDownload: () => void;
  onRetry: () => void;
  onCopyLink: () => void;
  copied: boolean;
  shareUrl: string;
  shareText: string;
  platforms: SharePlatform[];
  onPlatform: (platform: SharePlatform) => void;
};

export default function CheckoutModal({
  open,
  onClose,
  rendering,
  error,
  ready,
  videoUrl,
  onDownload,
  onRetry,
  onCopyLink,
  copied,
  shareUrl,
  shareText,
  platforms,
  onPlatform,
}: CheckoutModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rendering) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, rendering]);

  if (!open) return null;

  return (
    <div
      className="checkoutOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={rendering ? "Creating your holo video" : ready ? "Your holo card" : "Download"}
      onClick={rendering ? undefined : onClose}
    >
      <div
        className={`checkoutModal${ready ? " checkoutModal--success" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {rendering ? (
          <div className="checkoutModalBody">
            <div className="checkoutLoading" aria-live="polite">
              <span className="checkoutSpinner" aria-hidden />
              <p className="checkoutLoadingTitle">Creating your holo video</p>
              <p className="checkoutLoadingSub">Rendering holo shine and motion…</p>
            </div>
          </div>
        ) : null}

        {!rendering && ready && videoUrl ? (
          <div className="checkoutSuccess">
            <div className="checkoutSuccessMedia">
              <video
                className="sharePreview"
                src={videoUrl}
                autoPlay
                loop
                muted
                playsInline
                controls
              />
            </div>
            <div className="checkoutSuccessPanel">
              <p className="checkoutSuccessTitle">Your holo card is ready</p>
              <p className="shareHint">
                Post your card or grab the file again. On Instagram, upload the downloaded video
                in the app.
              </p>

              {error ? <p className="shareError">{error}</p> : null}

              <div className="shareActions">
                <button type="button" className="shareAction primary" onClick={onDownload}>
                  Download video
                </button>
                <button type="button" className="shareAction" onClick={onCopyLink}>
                  {copied ? "Link copied" : "Copy link"}
                </button>
              </div>

              <div className="sharePlatforms">
                {platforms.map((platform) => {
                  const href = platform.href?.(shareUrl, shareText);
                  if (href && platform.id !== "native") {
                    return (
                      <a
                        key={platform.id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sharePlatform"
                        title={platform.note}
                        onClick={
                          platform.id === "instagram"
                            ? (e) => {
                                e.preventDefault();
                                onPlatform(platform);
                              }
                            : undefined
                        }
                      >
                        {platform.label}
                      </a>
                    );
                  }

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className="sharePlatform"
                      title={platform.note}
                      onClick={() => onPlatform(platform)}
                    >
                      {platform.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {!rendering && !ready ? (
          <div className="checkoutModalBody">
            {error ? (
              <>
                <p className="shareError">{error}</p>
                <button type="button" className="checkoutCta" onClick={onRetry}>
                  Try again
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
