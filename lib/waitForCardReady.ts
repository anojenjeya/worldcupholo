async function waitForPaint() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function waitForImage(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

/** Ensure fonts, photos, and layout are settled before video capture. */
export async function waitForCardReady(stage: HTMLElement, timeoutMs = 20_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const card = stage.querySelector<HTMLElement>("[data-card-root]");
    const nameEl = stage.querySelector<HTMLElement>("[data-player-name]");
    const photoImg = stage.querySelector<HTMLImageElement>("[data-card-photo]");

    const nameReady = Boolean(nameEl?.textContent?.trim());
    const photoReady = !photoImg || (photoImg.complete && photoImg.naturalWidth > 0);

    if (card && nameReady && photoReady) {
      if (photoImg) await waitForImage(photoImg);
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      await waitForPaint();
      await waitForPaint();
      await waitForPaint();
      return;
    }

    await new Promise((r) => setTimeout(r, 80));
  }

  throw new Error("Your card wasn't ready in time. Please try downloading again.");
}
