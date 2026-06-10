import { createContext, destroyContext, domToCanvas } from "modern-screenshot";

export async function captureCardPng(
  stage: HTMLElement,
  scale = 3
): Promise<Blob> {
  const card = stage.querySelector<HTMLElement>("[data-card-root]");
  if (!card) throw new Error("Could not find card to capture.");

  const rect = card.getBoundingClientRect();
  const context = await createContext(card, {
    scale,
    width: rect.width,
    height: rect.height,
    backgroundColor: "#060709",
    drawImageInterval: 0,
    autoDestruct: false,
    fetch: { requestInit: { mode: "cors" as RequestMode, cache: "force-cache" as RequestCache } },
  });

  try {
    const canvas = await domToCanvas(context);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not export card image."))),
        "image/png"
      );
    });
  } finally {
    destroyContext(context);
  }
}
