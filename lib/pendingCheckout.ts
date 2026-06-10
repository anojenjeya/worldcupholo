import type { CardStyle, Finish, Shine } from "@/lib/card";

const STORAGE_KEY = "wc_pending_checkout";

export type PendingCheckout = {
  name: string;
  team: string;
  cardStyle: CardStyle;
  shine: Shine;
  finish: Finish;
  photoDataUrl: string | null;
  photoCutout: boolean;
};

async function blobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function savePendingCheckout(
  state: Omit<PendingCheckout, "photoDataUrl"> & { photoUrl: string | null }
): Promise<void> {
  const photoDataUrl = state.photoUrl ? await blobUrlToDataUrl(state.photoUrl) : null;
  const payload: PendingCheckout = {
    name: state.name,
    team: state.team,
    cardStyle: state.cardStyle,
    shine: state.shine,
    finish: state.finish,
    photoDataUrl,
    photoCutout: state.photoCutout,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCheckout;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(STORAGE_KEY);
}
