"use client";

import { useEffect, useState } from "react";
import { domToPng } from "modern-screenshot";
import { CHARITY } from "@/lib/charity";
import type { SharePlatform } from "@/lib/cardShareUrl";
import { PRICE_LABEL } from "@/lib/pricing";

function TablerIcon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const PERK_ICONS = {
  video: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  art: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
};

type CheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  checkingOut: boolean;
  checkoutPhase: "idle" | "redirect" | "render";
  error: string | null;
  purchased: boolean;
  videoUrl: string | null;
  displayName: string;
  team: string;
  styleName: string;
  finish: string;
  captureRef: React.RefObject<HTMLElement | null>;
  onPurchase: () => void;
  onDownload: () => void;
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
  checkingOut,
  checkoutPhase,
  error,
  purchased,
  videoUrl,
  displayName,
  team,
  styleName,
  finish,
  captureRef,
  onPurchase,
  onDownload,
  onCopyLink,
  copied,
  shareUrl,
  shareText,
  platforms,
  onPlatform,
}: CheckoutModalProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || purchased) return;
    const stage = captureRef.current;
    if (!stage) return;

    let cancelled = false;
    void domToPng(stage, { scale: 0.22, quality: 0.85 }).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [open, purchased, captureRef, displayName, team, styleName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !checkingOut) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, checkingOut]);

  if (!open) return null;

  const loadingTitle =
    checkoutPhase === "redirect"
      ? "Redirecting to secure checkout"
      : "Creating your holo video";
  const loadingSub =
    checkoutPhase === "redirect"
      ? "You'll pay with Stripe — then we render your card."
      : "Rendering holo shine and motion…";

  return (
    <div
      className="checkoutOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={
        checkingOut
          ? loadingTitle
          : purchased
            ? "Your holo card"
            : "Buy card checkout"
      }
      onClick={checkingOut ? undefined : onClose}
    >
      <div
        className={`checkoutModal${purchased ? " checkoutModal--success" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!purchased ? (
          <section className="checkoutCharityHero" aria-labelledby="charity-heading">
            <p className="checkoutCharityEyebrow" id="charity-heading">
              Play it forward
            </p>
            <p className="checkoutCharityLead">{CHARITY.checkoutLead}</p>
            <p className="checkoutCharitySub">
              {CHARITY.checkoutSub}{" "}
              <a href={CHARITY.url} target="_blank" rel="noopener noreferrer">
                Learn about {CHARITY.shortName}
              </a>
            </p>
          </section>
        ) : null}

        {checkingOut ? (
          <div className="checkoutModalBody">
            <div className="checkoutLoading" aria-live="polite">
              <span className="checkoutSpinner" aria-hidden />
              <p className="checkoutLoadingTitle">{loadingTitle}</p>
              <p className="checkoutLoadingSub">{loadingSub}</p>
            </div>
          </div>
        ) : null}

        {!checkingOut && purchased && videoUrl ? (
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
              <p className="buySuccess">{CHARITY.successThanks}</p>
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

        {!checkingOut && !purchased ? (
          <div className="checkoutModalBody">
            <div className="checkoutPlayerStrip">
              <div className="checkoutThumb">
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt="" draggable={false} />
                ) : (
                  <span className="checkoutThumbFallback" aria-hidden />
                )}
              </div>
              <div className="checkoutPlayerMeta">
                <p className="checkoutPlayerName">{displayName}</p>
                <p className="checkoutPlayerDetail">
                  {team} · {styleName} · {finish}
                </p>
              </div>
            </div>

            <ul className="checkoutPerks">
              <li>
                <span className="checkoutPerkIcon">
                  <TablerIcon d={PERK_ICONS.video} />
                </span>
                10s holo animation video
              </li>
              <li>
                <span className="checkoutPerkIcon">
                  <TablerIcon d={PERK_ICONS.art} />
                </span>
                Full holo artwork &amp; crest
              </li>
              <li>
                <span className="checkoutPerkIcon">
                  <TablerIcon d={PERK_ICONS.share} />
                </span>
                Yours to post &amp; share
              </li>
            </ul>

            {error ? <p className="shareError">{error}</p> : null}

            <button
              type="button"
              className="checkoutCta"
              onClick={onPurchase}
              disabled={checkingOut}
            >
              Buy card — {PRICE_LABEL}
            </button>

            <p className="checkoutDisclaimer">
              Payments processed securely by Stripe. Net proceeds donated to{" "}
              <a href={CHARITY.url} target="_blank" rel="noopener noreferrer">
                {CHARITY.name}
              </a>{" "}
              (501(c)(3), Tax ID {CHARITY.taxId}). By purchasing you receive a personal-use
              digital video; no physical card is shipped.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
